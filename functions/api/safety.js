const OVERPASS='https://overpass-api.de/api/interpreter';
const CAMERA_API='https://api.data.go.kr/openapi/tn_pubr_public_unmanned_traffic_camera_api';

export async function onRequestPost({request,env}){
  try{
    const body=await request.json();
    const points=normalizePoints(body?.points||[]);
    if(!points.length)return json({events:[],providers:[],note:'no route points'});

    const providers=[];
    const events=[];

    // 1) 경찰청/지자체 전국 무인교통단속카메라 표준 API (공공데이터포털)
    if(env?.DATA_GO_KR_SERVICE_KEY){
      try{
        const official=await loadOfficialCameras(points,env);
        events.push(...official.events);
        providers.push({name:'data.go.kr-camera',ok:true,count:official.events.length,regions:official.regions});
      }catch(e){providers.push({name:'data.go.kr-camera',ok:false,error:String(e?.message||e)})}
    }else{
      providers.push({name:'data.go.kr-camera',ok:false,error:'DATA_GO_KR_SERVICE_KEY not configured'});
    }

    // 2) OSM/Overpass 보조 데이터: 이동식 카메라, 학교, 공사, 사고, maxspeed
    try{
      const osm=await loadOverpass(points);
      events.push(...osm);
      providers.push({name:'osm-overpass',ok:true,count:osm.length});
    }catch(e){providers.push({name:'osm-overpass',ok:false,error:String(e?.message||e)})}

    return json({events:dedupe(events),providers,coverage:'official-camera + community-supplement'},200,120);
  }catch(e){return json({events:[],providers:[],warning:String(e?.message||e)},200,30)}
}

async function loadOfficialCameras(points,env){
  const regions=await resolveRegions(points,env);
  const events=[];
  for(const r of regions.slice(0,8)){
    const rows=await fetchCameraRegion(r,env.DATA_GO_KR_SERVICE_KEY);
    for(const x of rows){
      const lat=Number(x.latitude),lng=Number(x.longitude);if(!Number.isFinite(lat)||!Number.isFinite(lng))continue;
      if(distanceToRoute(lat,lng,points)>900)continue;
      const reg=String(x.regltSe??'').trim();
      const location=String(x.itlpc||x.rdnmadr||x.lnmadr||'').trim();
      events.push({
        id:`police-camera:${x.mnlssRegltCameraManageNo||`${lat}:${lng}`}`,
        type:cameraType(reg),lat,lng,name:location,maxspeed:num(x.lmttVe)||0,
        enforcement:reg,protectedArea:String(x.prtcareaType||''),
        source:'전국무인교통단속카메라표준데이터',authority:String(x.institutionNm||'경찰청/지자체'),referenceDate:x.referenceDate||''
      });
    }
  }
  return {events,regions};
}

async function resolveRegions(points,env){
  if(!env?.KAKAO_REST_API_KEY)return [];
  const candidates=[points[0],points[Math.floor(points.length/2)],points.at(-1)].filter(Boolean),seen=new Set(),out=[];
  for(const p of candidates){
    const u=new URL('https://dapi.kakao.com/v2/local/geo/coord2regioncode.json');u.searchParams.set('x',p.lng);u.searchParams.set('y',p.lat);
    const r=await fetch(u,{headers:{Authorization:`KakaoAK ${env.KAKAO_REST_API_KEY}`}});if(!r.ok)continue;
    const d=await r.json().catch(()=>({documents:[]}));const doc=(d.documents||[]).find(x=>x.region_type==='H')||d.documents?.[0];if(!doc)continue;
    const ctprvn=normalizeProvince(doc.region_1depth_name),signgu=normalizeDistrict(doc.region_2depth_name);
    const k=`${ctprvn}|${signgu}`;if(ctprvn&&!seen.has(k)){seen.add(k);out.push({ctprvn,signgu})}
  }
  return out;
}
function normalizeProvince(v=''){return String(v).replace('특별자치도','특별자치도').trim()}
function normalizeDistrict(v=''){return String(v).trim()}

async function fetchCameraRegion(region,key){
  const qs=new URLSearchParams({pageNo:'1',numOfRows:'1000',type:'json'});
  if(region.ctprvn)qs.set('ctprvnNm',region.ctprvn);
  if(region.signgu)qs.set('signguNm',region.signgu);
  const keyPart=String(key).includes('%')?String(key):encodeURIComponent(String(key));
  const url=`${CAMERA_API}?serviceKey=${keyPart}&${qs.toString()}`;
  const r=await fetch(url,{headers:{accept:'application/json'}});if(!r.ok)throw new Error(`camera API HTTP ${r.status}`);
  const d=await r.json().catch(()=>null);if(!d)throw new Error('camera API invalid JSON');
  const header=d.response?.header||d.header||{};const resultCode=String(header.resultCode??'00');
  if(resultCode!=='00')throw new Error(`camera API ${resultCode}: ${header.resultMsg||'error'}`);
  const body=d.response?.body||d.body||{};const items=body.items?.item??body.items??d.items??[];
  return Array.isArray(items)?items:(items?[items]:[]);
}
function cameraType(reg=''){
  const s=String(reg);
  // 표준 단속구분 값은 기관별로 숫자/문자가 혼재할 수 있어 명칭을 우선하고, 1은 일반적으로 속도 단속으로 취급한다.
  if(/신호.*속도|속도.*신호|신호과속/.test(s))return 'signal_speed_camera';
  if(/신호/.test(s)||s==='2')return 'signal_camera';
  if(/속도|과속/.test(s)||s==='1')return 'speed_camera';
  return 'traffic_camera';
}

async function loadOverpass(points){
  const clauses=[];
  for(const p of points){
    const a=`around:260,${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
    clauses.push(`node(${a})["highway"="speed_camera"];`);
    clauses.push(`node(${a})["enforcement"~"maxspeed|traffic_signals|mobile",i];`);
    clauses.push(`nwr(${a})["school_zone"="yes"];`);
    clauses.push(`nwr(${a})["zone:traffic"~"school",i];`);
    clauses.push(`nwr(${a})["amenity"="school"];`);
    clauses.push(`nwr(${a})["highway"="construction"];`);
    clauses.push(`nwr(${a})["construction"];`);
    clauses.push(`nwr(${a})["hazard"~"accident|collision|crash",i];`);
    clauses.push(`way(${a})["maxspeed"];`);
    clauses.push(`way(${a})["tunnel"="yes"];`);
  }
  const query=`[out:json][timeout:12];(${clauses.join('')});out center tags;`;
  const r=await fetch(OVERPASS,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded;charset=UTF-8','user-agent':'JofamsNavi/7.4'},body:new URLSearchParams({data:query}).toString()});
  if(!r.ok)throw new Error(`Overpass HTTP ${r.status}`);
  const data=await r.json().catch(()=>({elements:[]})),events=[];
  for(const e of data.elements||[]){
    const lat=Number(e.lat??e.center?.lat),lng=Number(e.lon??e.center?.lon);if(!Number.isFinite(lat)||!Number.isFinite(lng))continue;
    const t=e.tags||{};let type='';
    if(/mobile/i.test(t.enforcement||''))type='mobile_camera';
    else if(t.highway==='speed_camera'||/maxspeed/i.test(t.enforcement||''))type='speed_camera';
    else if(/traffic_signals/i.test(t.enforcement||''))type='signal_camera';
    else if(t.school_zone==='yes'||/school/i.test(t['zone:traffic']||''))type='school_zone';
    else if(t.amenity==='school')type='school_nearby';
    else if(t.highway==='construction'||t.construction)type='construction';
    else if(/accident|collision|crash/i.test(t.hazard||''))type='accident';
    else if(t.maxspeed)type='speed_limit';
    else if(t.tunnel==='yes')type='tunnel';
    if(!type)continue;
    events.push({id:`osm:${type}:${e.type}:${e.id}`,type,lat,lng,name:t.name||t['name:ko']||'',maxspeed:num(t.maxspeed)||0,source:'OpenStreetMap'});
  }
  return events;
}
function normalizePoints(xs){
  const valid=xs.map(x=>({lng:Number(x?.lng??x?.[0]),lat:Number(x?.lat??x?.[1])})).filter(x=>Number.isFinite(x.lng)&&Number.isFinite(x.lat));
  if(valid.length<=28)return valid;const out=[];for(let i=0;i<28;i++)out.push(valid[Math.round(i*(valid.length-1)/27)]);return out;
}
function distanceToRoute(lat,lng,pts){let best=Infinity;for(const p of pts){const d=hav(lat,lng,p.lat,p.lng);if(d<best)best=d}return best}
function hav(lat1,lon1,lat2,lon2){const R=6371000,p=Math.PI/180,a=Math.sin((lat2-lat1)*p/2)**2+Math.cos(lat1*p)*Math.cos(lat2*p)*Math.sin((lon2-lon1)*p/2)**2;return 2*R*Math.asin(Math.sqrt(a))}
function dedupe(xs){const seen=new Set(),out=[];for(const e of xs){const k=`${e.type}:${Math.round(Number(e.lat)*10000)}:${Math.round(Number(e.lng)*10000)}`;if(seen.has(k))continue;seen.add(k);out.push(e)}return out}
function num(v){const m=String(v??'').match(/\d+/);return m?Number(m[0]):0}
function json(data,status=200,maxAge=120){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':`public, max-age=${maxAge}`}})}
