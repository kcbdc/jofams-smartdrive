const OVERPASS='https://overpass-api.de/api/interpreter';

export async function onRequestPost({request}){
  try{
    const body=await request.json();
    const points=normalizePoints(body?.points||[]);
    if(points.length<1)return json({events:[],provider:'osm-overpass',note:'no route points'});
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
    }
    const query=`[out:json][timeout:12];(${clauses.join('')});out center tags;`;
    const r=await fetch(OVERPASS,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded;charset=UTF-8','user-agent':'JofamsSmartDrive/6.8'},body:new URLSearchParams({data:query}).toString()});
    if(!r.ok)return json({events:[],provider:'osm-overpass',warning:`Overpass HTTP ${r.status}`},200);
    const data=await r.json().catch(()=>({elements:[]}));
    const seen=new Set(),events=[];
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
      if(!type)continue;
      const key=`${type}:${e.type}:${e.id}`;if(seen.has(key))continue;seen.add(key);
      events.push({id:key,type,lat,lng,name:t.name||t['name:ko']||'',maxspeed:num(t.maxspeed)||0,source:'OpenStreetMap'});
    }
    return json({events,provider:'osm-overpass',coverage:'community-data'});
  }catch(e){return json({events:[],provider:'osm-overpass',warning:e.message},200)}
}
function normalizePoints(xs){
  const valid=xs.map(x=>({lng:Number(x?.lng??x?.[0]),lat:Number(x?.lat??x?.[1])})).filter(x=>Number.isFinite(x.lng)&&Number.isFinite(x.lat));
  if(valid.length<=28)return valid;
  const out=[];for(let i=0;i<28;i++)out.push(valid[Math.round(i*(valid.length-1)/27)]);return out;
}
function num(v){const m=String(v??'').match(/\d+/);return m?Number(m[0]):0}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=300'}})}
