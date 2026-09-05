const OVERPASS='https://overpass-api.de/api/interpreter';

export async function onRequestPost({request}){
  try{
    const body=await request.json();
    const points=normalizePoints(body?.points||[]);
    if(!points.length)return json({events:[],providers:[],note:'no route points'});

    const providers=[];
    const events=[];

    // MVP 7.5: 공식 무인단속카메라 정보는 배포 패키지의 로컬 JSON(data/unmanned_traffic_cameras.json)에서 클라이언트가 직접 로드한다.
    providers.push({name:'local-static-camera-dataset',ok:true,note:'fixed cameras are loaded from bundled JSON on the client'});

    // 보조 데이터: OSM/Overpass에서 스쿨존, 공사, 사고, maxspeed, 터널 정보를 조회한다.
    try{
      const osm=await loadOverpass(points);
      events.push(...osm);
      providers.push({name:'osm-overpass',ok:true,count:osm.length});
    }catch(e){providers.push({name:'osm-overpass',ok:false,error:String(e?.message||e)})}

    return json({events:dedupe(events),providers,coverage:'community-supplement only'},200,120);
  }catch(e){return json({events:[],providers:[],warning:String(e?.message||e)},200,30)}
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
    // 대형차 제한(높이/중량/폭), 철길건널목, 횡단보도, 실버존/장애인보호구역 — 도로표지판 카탈로그 확장
    clauses.push(`way(${a})["maxheight"];`);
    clauses.push(`way(${a})["maxweight"];`);
    clauses.push(`way(${a})["maxwidth"];`);
    clauses.push(`node(${a})["railway"="level_crossing"];`);
    clauses.push(`node(${a})["highway"="crossing"];`);
    clauses.push(`nwr(${a})["zone:traffic"~"elderly",i];`);
    clauses.push(`nwr(${a})["zone:traffic"~"disabled",i];`);
  }
  const query=`[out:json][timeout:12];(${clauses.join('')});out center tags;`;
  const r=await fetch(OVERPASS,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded;charset=UTF-8','user-agent':'JofamsNavi/7.5'},body:new URLSearchParams({data:query}).toString()});
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
    else if(num(t.maxheight)>0)type='height_limit';
    else if(num(t.maxweight)>0)type='weight_limit';
    else if(num(t.maxwidth)>0)type='width_limit';
    else if(t.railway==='level_crossing')type='railway_crossing';
    else if(t.highway==='crossing')type='crosswalk';
    else if(/elderly/i.test(t['zone:traffic']||''))type='silver_zone';
    else if(/disabled/i.test(t['zone:traffic']||''))type='disabled_zone';
    if(!type)continue;
    const limitValue=num(t.maxheight)||num(t.maxwidth)||num(t.maxweight)||0;
    events.push({id:`osm:${type}:${e.type}:${e.id}`,type,lat,lng,name:t.name||t['name:ko']||t.ref||'',roadName:t.name||t['name:ko']||t.ref||'',maxspeed:num(t.maxspeed)||0,limitValue,source:'OpenStreetMap'});
  }
  return events;
}
function normalizePoints(xs){
  const valid=xs.map(x=>({lng:Number(x?.lng??x?.[0]),lat:Number(x?.lat??x?.[1])})).filter(x=>Number.isFinite(x.lng)&&Number.isFinite(x.lat));
  if(valid.length<=28)return valid;const out=[];for(let i=0;i<28;i++)out.push(valid[Math.round(i*(valid.length-1)/27)]);return out;
}
function dedupe(xs){const seen=new Set(),out=[];for(const e of xs){const k=`${e.type}:${Math.round(Number(e.lat)*10000)}:${Math.round(Number(e.lng)*10000)}`;if(seen.has(k))continue;seen.add(k);out.push(e)}return out}
function num(v){const m=String(v??'').match(/\d+(\.\d+)?/);return m?Number(m[0]):0}
function json(data,status=200,maxAge=120){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':`public, max-age=${maxAge}`}})}
