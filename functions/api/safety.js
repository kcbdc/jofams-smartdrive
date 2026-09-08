const PUBLIC_CAMERA_API='https://api.data.go.kr/openapi/tn_pubr_public_unmanned_traffic_camera_api';
const OVERPASS='https://overpass-api.de/api/interpreter';
const OPEN_METEO='https://api.open-meteo.com/v1/forecast';
const KOROAD_LG='https://opendata.koroad.or.kr/data/rest/frequentzone/lg';


function publicDataKey(env){return String(env.PUBLIC_DATA_SERVICE_KEY||env.DATA_GO_KR_SERVICE_KEY||'').trim()}
function decodedKey(v){try{return decodeURIComponent(String(v||'').trim())}catch{return String(v||'').trim()}}
function normalizeNationalCamera(x){
  const lat=Number(x.latitude??x.lat??x.위도),lng=Number(x.longitude??x.lot??x.lng??x.경도);
  if(!Number.isFinite(lat)||!Number.isFinite(lng))return null;
  const sp=Number(x.limitSpeed??x.speedLimit??x.제한속도??x.restrictSpeed);
  return {type:'speed_camera',lat,lng,maxspeed:Number.isFinite(sp)&&sp>0?sp:null,
    source:'data.go.kr-national-unmanned-camera',
    roadName:String(x.roadRouteName??x.roadName??x.도로노선명??'').trim(),
    direction:String(x.roadRouteDirection??x.roadDirection??x.도로노선방향??'').trim(),
    name:String(x.installationLocation??x.설치장소??x.cameraType??x.카메라구분??'무인교통단속카메라').trim()};
}
function nationalRows(d){
  const b=d?.response?.body||d?.body||d||{};
  let rows=b?.items?.item||b?.items||d?.items||d?.data||[];
  if(!Array.isArray(rows))rows=rows?[rows]:[];
  return rows.map(normalizeNationalCamera).filter(Boolean);
}
function pointSegMeters(p,a,b){
  const lat0=p.lat*Math.PI/180,sx=111320*Math.cos(lat0),sy=110540;
  const px=p.lng*sx,py=p.lat*sy,ax=a.lng*sx,ay=a.lat*sy,bx=b.lng*sx,by=b.lat*sy;
  const vx=bx-ax,vy=by-ay,wx=px-ax,wy=py-ay,vv=vx*vx+vy*vy;
  const t=vv?Math.max(0,Math.min(1,(wx*vx+wy*vy)/vv)):0;
  return Math.hypot(px-(ax+t*vx),py-(ay+t*vy));
}
function cameraNearRoute(cam,points,max=45){
  let best=Infinity;
  for(let i=0;i<points.length-1;i++){
    const d=pointSegMeters(cam,{lat:points[i].lat,lng:points[i].lng},{lat:points[i+1].lat,lng:points[i+1].lng});
    if(d<best)best=d;if(best<=18)break;
  }
  return best<=max;
}
async function loadNationalRouteCameras(points,env){
  const key=publicDataKey(env);if(!key||!points?.length)return [];
  let west=Infinity,south=Infinity,east=-Infinity,north=-Infinity;
  for(const p of points){west=Math.min(west,p.lng);east=Math.max(east,p.lng);south=Math.min(south,p.lat);north=Math.max(north,p.lat)}
  const out=[],perPage=1000,maxPages=40,pad=.08;
  for(let page=1;page<=maxPages;page++){
    const u=new URL(PUBLIC_CAMERA_API);
    u.searchParams.set('serviceKey',decodedKey(key));u.searchParams.set('pageNo',String(page));u.searchParams.set('numOfRows',String(perPage));u.searchParams.set('type','json');
    const r=await fetch(u,{headers:{accept:'application/json'}});if(!r.ok)break;
    const text=await r.text();let d;try{d=JSON.parse(text)}catch{break}
    const rows=nationalRows(d);if(!rows.length)break;
    for(const c of rows){
      if(c.lng<west-pad||c.lng>east+pad||c.lat<south-pad||c.lat>north+pad)continue;
      if(cameraNearRoute(c,points,45))out.push(c);
    }
    const total=Number(d?.response?.body?.totalCount);
    if(rows.length<perPage||(Number.isFinite(total)&&page*perPage>=total))break;
  }
  return out;
}

export async function onRequestPost({request,env}){
  try{
    const body=await request.json();
    const points=normalizePoints(body?.points||[]);
    const trafficSamples=normalizeTrafficSamples(body?.trafficSamples||[]);
    if(!points.length)return json({events:[],providers:[],note:'no route points'});
    const providers=[],events=[];
    providers.push({name:'local-static-camera-dataset',ok:true,note:'fixed cameras are loaded from bundled JSON on the client'});

    try{const weather=await loadWeatherHazards(points);events.push(...weather);providers.push({name:'open-meteo',ok:true,count:weather.length})}
    catch(e){providers.push({name:'open-meteo',ok:false,error:String(e?.message||e)})}

    try{const osm=await loadOverpass(points);events.push(...osm);providers.push({name:'osm-overpass',ok:true,count:osm.length})}
    catch(e){providers.push({name:'osm-overpass',ok:false,error:String(e?.message||e)})}

    if(env?.DB){
      try{await ensureCongestionTable(env.DB);if(trafficSamples.length)await recordCongestionSamples(env.DB,trafficSamples);const chronic=await loadChronicCongestion(env.DB,points);events.push(...chronic);providers.push({name:'d1-congestion-statistics',ok:true,count:chronic.length,samples:trafficSamples.length})}
      catch(e){providers.push({name:'d1-congestion-statistics',ok:false,error:String(e?.message||e)})}
    }else providers.push({name:'d1-congestion-statistics',ok:false,note:'DB binding not configured'});

    if(env?.KOROAD_AUTH_KEY&&env?.KAKAO_REST_API_KEY){
      try{const hotspots=await loadKoroadHotspots(points,env);events.push(...hotspots);providers.push({name:'koroad-accident-hotspots',ok:true,count:hotspots.length})}
      catch(e){providers.push({name:'koroad-accident-hotspots',ok:false,error:String(e?.message||e)})}
    }else providers.push({name:'koroad-accident-hotspots',ok:false,note:'KOROAD_AUTH_KEY or KAKAO_REST_API_KEY not configured'});

    try{
      const national=await loadNationalRouteCameras(points,env);
      events.push(...national);
      providers.push({name:'data.go.kr-national-unmanned-camera',ok:true,count:national.length});
    }catch(e){providers.push({name:'data.go.kr-national-unmanned-camera',ok:false,error:String(e?.message||e)})}

    return json({events:dedupe(events),providers,coverage:'weather + statistics + road-safety supplements + national unmanned cameras'},200,120);
  }catch(e){return json({events:[],providers:[],warning:String(e?.message||e)},200,30)}
}

async function loadWeatherHazards(points){
  const sample=spread(points,6),rows=await Promise.all(sample.map(async(p)=>{
    const u=new URL(OPEN_METEO);u.searchParams.set('latitude',p.lat);u.searchParams.set('longitude',p.lng);u.searchParams.set('current','visibility,precipitation,rain,snowfall,weather_code,cloud_cover');u.searchParams.set('timezone','Asia/Seoul');
    const r=await fetch(u,{headers:{'user-agent':'JofamsSmartDrive/7.5'}});if(!r.ok)throw new Error(`Open-Meteo HTTP ${r.status}`);return{p,d:await r.json()};
  }));
  const out=[];
  for(const {p,d} of rows){const x=d?.current||{},vis=num(x.visibility),prec=num(x.precipitation),rain=num(x.rain),snow=num(x.snowfall),code=Number(x.weather_code)||0;
    if((vis>0&&vis<=2000)||[45,48].includes(code))out.push({id:`weather:fog:${p.lat.toFixed(4)}:${p.lng.toFixed(4)}`,type:'fog_zone',lat:p.lat,lng:p.lng,visibility:vis,source:'Open-Meteo current weather'});
    if(prec>=3||rain>=3||[63,65,80,81,82,95,96,99].includes(code))out.push({id:`weather:rain:${p.lat.toFixed(4)}:${p.lng.toFixed(4)}`,type:'heavy_rain_zone',lat:p.lat,lng:p.lng,precipitation:prec||rain,source:'Open-Meteo current weather'});
    if(snow>0||[71,73,75,77,85,86].includes(code))out.push({id:`weather:snow:${p.lat.toFixed(4)}:${p.lng.toFixed(4)}`,type:'snow_ice_zone',lat:p.lat,lng:p.lng,source:'Open-Meteo current weather'});
  }
  return out;
}

async function ensureCongestionTable(db){
  await db.prepare(`CREATE TABLE IF NOT EXISTS road_congestion_stats (cell_key TEXT PRIMARY KEY, lat REAL NOT NULL, lng REAL NOT NULL, road_name TEXT, sample_count INTEGER NOT NULL DEFAULT 0, severe_count INTEGER NOT NULL DEFAULT 0, last_state INTEGER, last_speed REAL, first_seen TEXT NOT NULL DEFAULT (datetime('now')), last_seen TEXT NOT NULL DEFAULT (datetime('now')))` ).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_road_congestion_stats_latlng ON road_congestion_stats(lat,lng)`).run();
}
async function recordCongestionSamples(db,samples){
  for(const x of samples.slice(0,20)){const key=gridKey(x.lat,x.lng),severe=isCongested(x)?1:0;
    await db.prepare(`INSERT INTO road_congestion_stats(cell_key,lat,lng,road_name,sample_count,severe_count,last_state,last_speed,first_seen,last_seen) VALUES(?,?,?,?,1,?,?,?,datetime('now'),datetime('now')) ON CONFLICT(cell_key) DO UPDATE SET lat=excluded.lat,lng=excluded.lng,road_name=CASE WHEN excluded.road_name<>'' THEN excluded.road_name ELSE road_congestion_stats.road_name END,sample_count=road_congestion_stats.sample_count+1,severe_count=road_congestion_stats.severe_count+excluded.severe_count,last_state=excluded.last_state,last_speed=excluded.last_speed,last_seen=datetime('now')`)
      .bind(key,x.lat,x.lng,x.roadName||'',severe,x.trafficState,x.trafficSpeed).run();
  }
}
async function loadChronicCongestion(db,points){
  const box=bounds(points,.006),q=await db.prepare(`SELECT cell_key,lat,lng,road_name,sample_count,severe_count,last_state,last_speed FROM road_congestion_stats WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ? AND sample_count>=5 AND severe_count*1.0/sample_count>=0.60 AND last_seen>=datetime('now','-30 day') ORDER BY severe_count*1.0/sample_count DESC,sample_count DESC LIMIT 80`).bind(box.minLat,box.maxLat,box.minLng,box.maxLng).all();
  return (q.results||[]).map(x=>({id:`d1:congestion:${x.cell_key}`,type:'chronic_congestion',lat:Number(x.lat),lng:Number(x.lng),name:x.road_name||'상습정체 구간',sampleCount:Number(x.sample_count)||0,congestionRatio:(Number(x.severe_count)||0)/Math.max(1,Number(x.sample_count)||1),source:'Jofams D1 traffic statistics'}));
}

async function loadKoroadHotspots(points,env){
  const regions=await resolveRegions(spread(points,3),env.KAKAO_REST_API_KEY),year=String(env.KOROAD_STATS_YEAR||'2024'),out=[];
  for(const reg of regions){const u=new URL(KOROAD_LG);u.searchParams.set('authKey',env.KOROAD_AUTH_KEY);u.searchParams.set('searchYearCd',year);u.searchParams.set('siDo',reg.sido);u.searchParams.set('guGun',reg.gugun);u.searchParams.set('type','json');u.searchParams.set('numOfRows','10');u.searchParams.set('pageNo','1');
    const r=await fetch(u,{headers:{'user-agent':'JofamsSmartDrive/7.5'}});if(!r.ok)throw new Error(`KOROAD HTTP ${r.status}`);const d=await r.json();let items=d?.items?.item||[];if(!Array.isArray(items))items=items?[items]:[];
    for(const x of items){const lat=Number(x.la_crd),lng=Number(x.lo_crd);if(!Number.isFinite(lat)||!Number.isFinite(lng))continue;out.push({id:`koroad:hotspot:${x.afos_fid||x.spot_cd||`${lat}:${lng}`}`,type:'accident_hotspot',lat,lng,name:x.spot_nm||x.sido_sgg_nm||'사고다발지역',accidentCount:Number(x.occrrnc_cnt)||0,casualtyCount:Number(x.caslt_cnt)||0,year,source:'KOROAD frequentzone/lg'});}
  }
  return out;
}
async function resolveRegions(points,key){const map=new Map();for(const p of points){const u=new URL('https://dapi.kakao.com/v2/local/geo/coord2regioncode.json');u.searchParams.set('x',p.lng);u.searchParams.set('y',p.lat);const r=await fetch(u,{headers:{Authorization:`KakaoAK ${key}`}});if(!r.ok)continue;const d=await r.json();const doc=(d.documents||[]).find(x=>x.region_type==='B')||(d.documents||[])[0];const code=String(doc?.code||'');if(code.length>=5)map.set(code.slice(0,5),{sido:code.slice(0,2),gugun:code.slice(2,5)})}return[...map.values()].slice(0,3)}

async function loadOverpass(points){
  const clauses=[];
  for(const p of points){const a=`around:260,${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
    clauses.push(`node(${a})["highway"="speed_camera"];`);clauses.push(`node(${a})["enforcement"~"maxspeed|traffic_signals|mobile",i];`);clauses.push(`nwr(${a})["school_zone"="yes"];`);clauses.push(`nwr(${a})["zone:traffic"~"school",i];`);clauses.push(`nwr(${a})["amenity"="school"];`);clauses.push(`nwr(${a})["highway"="construction"];`);clauses.push(`nwr(${a})["construction"];`);clauses.push(`nwr(${a})["hazard"~"accident|collision|crash",i];`);clauses.push(`way(${a})["maxspeed"];`);clauses.push(`way(${a})["tunnel"="yes"];`);clauses.push(`way(${a})["maxheight"];`);clauses.push(`way(${a})["maxweight"];`);clauses.push(`way(${a})["maxwidth"];`);clauses.push(`node(${a})["railway"="level_crossing"];`);clauses.push(`node(${a})["highway"="crossing"];`);clauses.push(`nwr(${a})["zone:traffic"~"elderly",i];`);clauses.push(`nwr(${a})["zone:traffic"~"disabled",i];`);
  }
  const query=`[out:json][timeout:12];(${clauses.join('')});out center tags;`,r=await fetch(OVERPASS,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded;charset=UTF-8','user-agent':'JofamsNavi/7.5'},body:new URLSearchParams({data:query}).toString()});if(!r.ok)throw new Error(`Overpass HTTP ${r.status}`);
  const data=await r.json().catch(()=>({elements:[]})),events=[];
  for(const e of data.elements||[]){const lat=Number(e.lat??e.center?.lat),lng=Number(e.lon??e.center?.lon);if(!Number.isFinite(lat)||!Number.isFinite(lng))continue;const t=e.tags||{};let type='';if(/mobile/i.test(t.enforcement||''))type='mobile_camera';else if(t.highway==='speed_camera'||/maxspeed/i.test(t.enforcement||''))type='speed_camera';else if(/traffic_signals/i.test(t.enforcement||''))type='signal_camera';else if(t.school_zone==='yes'||/school/i.test(t['zone:traffic']||''))type='school_zone';else if(t.amenity==='school')type='school_nearby';else if(t.highway==='construction'||t.construction)type='construction';else if(/accident|collision|crash/i.test(t.hazard||''))type='accident';else if(t.maxspeed)type='speed_limit';else if(t.tunnel==='yes')type='tunnel';else if(num(t.maxheight)>0)type='height_limit';else if(num(t.maxweight)>0)type='weight_limit';else if(num(t.maxwidth)>0)type='width_limit';else if(t.railway==='level_crossing')type='railway_crossing';else if(t.highway==='crossing')type='crosswalk';else if(/elderly/i.test(t['zone:traffic']||''))type='silver_zone';else if(/disabled/i.test(t['zone:traffic']||''))type='disabled_zone';if(!type)continue;const limitValue=num(t.maxheight)||num(t.maxwidth)||num(t.maxweight)||0;events.push({id:`osm:${type}:${e.type}:${e.id}`,type,lat,lng,name:t.name||t['name:ko']||t.ref||'',roadName:t.name||t['name:ko']||t.ref||'',maxspeed:num(t.maxspeed)||0,limitValue,source:'OpenStreetMap'});}
  return events;
}
function normalizePoints(xs){const valid=xs.map(x=>({lng:Number(x?.lng??x?.[0]),lat:Number(x?.lat??x?.[1])})).filter(x=>Number.isFinite(x.lng)&&Number.isFinite(x.lat));if(valid.length<=28)return valid;return spread(valid,28)}
function normalizeTrafficSamples(xs){return xs.map(x=>({lng:Number(x?.lng),lat:Number(x?.lat),roadName:String(x?.roadName||'').slice(0,120),trafficState:Number(x?.trafficState)||0,trafficSpeed:Number(x?.trafficSpeed)||0})).filter(x=>Number.isFinite(x.lng)&&Number.isFinite(x.lat)).slice(0,20)}
function spread(xs,max){if(xs.length<=max)return xs;return Array.from({length:max},(_,i)=>xs[Math.round(i*(xs.length-1)/(max-1))])}
function gridKey(lat,lng){return `${Number(lat).toFixed(3)}:${Number(lng).toFixed(3)}`}
function isCongested(x){const st=Number(x.trafficState)||0,sp=Number(x.trafficSpeed)||0;return st===1||st===2||st===6||(st===0&&sp>0&&sp<20)}
function bounds(points,pad=0){const lats=points.map(x=>x.lat),lngs=points.map(x=>x.lng);return{minLat:Math.min(...lats)-pad,maxLat:Math.max(...lats)+pad,minLng:Math.min(...lngs)-pad,maxLng:Math.max(...lngs)+pad}}
function dedupe(xs){const seen=new Set(),out=[];for(const e of xs){const k=`${e.type}:${Math.round(Number(e.lat)*10000)}:${Math.round(Number(e.lng)*10000)}`;if(seen.has(k))continue;seen.add(k);out.push(e)}return out}
function num(v){const m=String(v??'').match(/\d+(\.\d+)?/);return m?Number(m[0]):0}
function json(data,status=200,maxAge=120){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':`public, max-age=${maxAge}`}})}
