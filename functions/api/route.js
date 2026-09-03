export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(()=>({}));
  const origin = body.origin, destination = body.destination;
  if (!validPoint(origin) || !validPoint(destination)) return json({ error:'origin and destination are required' },400);

  if (env.KAKAO_REST_API_KEY) {
    const kakao = await routeWithKakao(origin,destination,body,env);
    if (kakao.ok) return json(kakao.data);
    console.warn('Kakao directions fallback:', kakao.error);
  }

  const osrm = await routeWithOsrm(origin,destination,body);
  if (osrm.ok) return json(osrm.data);
  return json({error:osrm.error||'routing provider unavailable'},502);
}

function validPoint(p){return p&&Number.isFinite(Number(p.lng))&&Number.isFinite(Number(p.lat))}

async function routeWithKakao(origin,destination,body,env){
  try{
    const affiliate = String(env.KAKAO_DIRECTIONS_TIER||'').toLowerCase()==='affiliate';
    const endpoint = affiliate ? 'https://apis-navi.kakaomobility.com/affiliate/v1/directions' : 'https://apis-navi.kakaomobility.com/v1/directions';
    const u = new URL(endpoint);
    const heading = Number(origin.heading);
    const originValue = Number.isFinite(heading) ? `${origin.lng},${origin.lat},angle=${Math.round((heading+360)%360)}` : `${origin.lng},${origin.lat}`;
    u.searchParams.set('origin', originValue);
    u.searchParams.set('destination', `${destination.lng},${destination.lat}`);
    const priority = ['RECOMMEND','TIME','DISTANCE','MAIN_ROAD','NO_TRAFFIC_INFO'].includes(body.priority) ? body.priority : 'RECOMMEND';
    u.searchParams.set('priority', priority);
    if (body.avoid) {
      const allowed = String(body.avoid).split('|').filter(x=>['ferries','toll','motorway','schoolzone','uturn'].includes(x));
      if (allowed.length) u.searchParams.set('avoid', allowed.join('|'));
    }
    u.searchParams.set('summary','false');
    u.searchParams.set('alternatives', body.alternatives===false ? 'false' : 'true');
    if(affiliate){
      u.searchParams.set('road_details','true');
      u.searchParams.set('road_details_extra_info','safety|roadevent');
    }

    const r = await fetch(u,{headers:{Authorization:`KakaoAK ${env.KAKAO_REST_API_KEY}`,'Content-Type':'application/json'}});
    const d = await r.json().catch(()=>({}));
    if(!r.ok) return {ok:false,error:`Kakao HTTP ${r.status}: ${d.msg||d.message||''}`};
    const parsed=(d.routes||[]).filter(x=>x?.result_code===0).map((route,index)=>parseKakaoRoute(route,d.trans_id,priority,index,affiliate));
    if(!parsed.length) return {ok:false,error:d.routes?.[0]?.result_msg||'Kakao route not found'};
    const primary=parsed[0];
    primary.alternatives=parsed.slice(1).map(stripNestedAlternatives);
    primary.meta={...(primary.meta||{}),tier:affiliate?'affiliate':'standard',alternatives:parsed.length};
    return {ok:true,data:primary};
  }catch(e){return {ok:false,error:e.message}}
}

function parseKakaoRoute(route,transId,priority,routeNo,affiliate){
  const geometry=[],roadSegments=[],rawGuides=[],roadEvents=[],safeties=[];
  (route.sections||[]).forEach((section,sectionIndex)=>{
    const sectionRoadSegments=[];
    (section.roads||[]).forEach((road,roadIndex)=>{
      const startIndex=geometry.length,v=road.vertexes||[];
      for(let i=0;i<v.length;i+=2){const p=[Number(v[i]),Number(v[i+1])];if(Number.isFinite(p[0])&&Number.isFinite(p[1]))geometry.push(p)}
      const endIndex=Math.max(startIndex,geometry.length-1);
      const extra=normalizeRoadExtra(road);
      const seg={sectionIndex,roadIndex,name:road.name||'',distance:Number(road.distance)||0,duration:Number(road.duration)||0,trafficSpeed:Number(road.traffic_speed)||0,trafficState:Number(road.traffic_state)||0,startIndex,endIndex,...extra};
      roadSegments.push(seg);sectionRoadSegments.push(seg);
      for(const x of extra.roadEvents||[])roadEvents.push({...x,sectionIndex,roadIndex,routeIndex:startIndex});
      for(const x of extra.safeties||[])safeties.push({...x,sectionIndex,roadIndex,routeIndex:startIndex});
    });
    (section.guides||[]).forEach((g,guideIndex)=>{
      const seg=Number(g.road_index)>=0 ? (sectionRoadSegments[g.road_index] || sectionRoadSegments[Math.max(0,g.road_index-1)] || null) : (sectionRoadSegments.at(-1) || null);
      rawGuides.push({id:`k_${routeNo}_${sectionIndex}_${guideIndex}`,sectionIndex,guideIndex,name:g.name||'',x:Number(g.x),y:Number(g.y),distance:Number(g.distance)||0,duration:Number(g.duration)||0,type:Number(g.type),guidance:g.guidance||guideTypeLabel(Number(g.type)),roadIndex:Number(g.road_index),roadName:seg?.name||'',lanes:g.lanes??g.lane_info??g.laneInfo??g.lane??null});
    });
  });
  const guides=rawGuides.map(g=>({...g,routeIndex:nearestGeometryIndex(g.x,g.y,geometry)}));
  return {
    provider:'kakao',routeNo,distance:Number(route.summary?.distance)||0,duration:Number(route.summary?.duration)||0,fare:route.summary?.fare||null,
    priority:route.summary?.priority||priority,geometry,guides,roadSegments,roadEvents,safeties,
    correctionResult:route.summary?.destination?.correction_result||route.summary?.correction_result||null,
    meta:{transId:transId||null,guideSource:'Kakao Mobility Directions guides',roadDetailTier:affiliate?'affiliate-extra':'standard'}
  };
}

function normalizeRoadExtra(road){
  const rawSafety=road.safety ?? road.safeties ?? road.safety_info ?? road.safetyInfo ?? [];
  const rawEvents=road.roadevent ?? road.road_event ?? road.road_events ?? road.roadEvents ?? [];
  const safeties=Array.isArray(rawSafety)?rawSafety:(rawSafety&&typeof rawSafety==='object'?[rawSafety]:[]);
  const roadEvents=Array.isArray(rawEvents)?rawEvents:(rawEvents&&typeof rawEvents==='object'?[rawEvents]:[]);
  const speedLimit=firstFinite(road.speed_limit,road.speedLimit,road.limit_speed,road.limitSpeed,road.max_speed,road.maxSpeed,road.regulation_speed,road.regulationSpeed,...safeties.map(x=>x?.speed_limit??x?.speedLimit??x?.limit_speed??x?.maxspeed));
  return {speedLimit:speedLimit||0,safeties:safeties.map(compactObject),roadEvents:roadEvents.map(compactObject)};
}
function compactObject(x){if(!x||typeof x!=='object')return {value:String(x??'')};const o={};for(const [k,v] of Object.entries(x)){if(['string','number','boolean'].includes(typeof v)||v===null)o[k]=v}return o}
function firstFinite(...xs){for(const x of xs){const n=Number(x);if(Number.isFinite(n)&&n>0)return n}return 0}
function stripNestedAlternatives(r){const x={...r};delete x.alternatives;return x}

async function routeWithOsrm(origin,destination,body){
  try{
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&steps=true&alternatives=3`;
    const r = await fetch(url,{headers:{'User-Agent':'JofamsSmartDrive/6.0'}});
    if(!r.ok)return {ok:false,error:`OSRM HTTP ${r.status}`};
    const d=await r.json();const parsed=(d.routes||[]).map((route,i)=>parseOsrmRoute(route,i));if(!parsed.length)return {ok:false,error:'route not found'};
    parsed[0].alternatives=parsed.slice(1).map(stripNestedAlternatives);return {ok:true,data:parsed[0]};
  }catch(e){return {ok:false,error:e.message}}
}
function parseOsrmRoute(route,routeNo){
  const geometry=route.geometry?.coordinates||[],guides=[],roadSegments=[];let stepNo=0;
  for(const leg of (route.legs||[]))for(const step of (leg.steps||[])){
    const loc=step.maneuver?.location||[],normalized=normalizeOsrmManeuver(step.maneuver?.type,step.maneuver?.modifier),routeIndex=nearestGeometryIndex(Number(loc[0]),Number(loc[1]),geometry);
    guides.push({id:`o_${routeNo}_${stepNo}`,name:step.name||'',x:Number(loc[0]),y:Number(loc[1]),distance:Number(step.distance)||0,duration:Number(step.duration)||0,type:normalized.type,guidance:normalized.guidance,roadIndex:stepNo,roadName:step.name||'',routeIndex});
    const geom=step.geometry?.coordinates||[];if(geom.length){const startIndex=nearestGeometryIndex(geom[0][0],geom[0][1],geometry),endIndex=nearestGeometryIndex(geom.at(-1)[0],geom.at(-1)[1],geometry);roadSegments.push({sectionIndex:0,roadIndex:stepNo,name:step.name||'',distance:Number(step.distance)||0,duration:Number(step.duration)||0,trafficSpeed:0,trafficState:0,speedLimit:0,safeties:[],roadEvents:[],startIndex:Math.min(startIndex,endIndex),endIndex:Math.max(startIndex,endIndex)})}stepNo++;
  }
  if(guides.length){guides[0]={...guides[0],type:100,guidance:'출발지'};guides[guides.length-1]={...guides.at(-1),type:101,guidance:'목적지'}}
  return {provider:'osrm-demo',routeNo,distance:Number(route.distance)||0,duration:Number(route.duration)||0,geometry,guides,roadSegments,roadEvents:[],safeties:[],meta:{guideSource:'OSRM steps fallback'}};
}

function normalizeOsrmManeuver(type,modifier){
  if(type==='arrive')return {type:101,guidance:'목적지'};if(type==='depart')return {type:100,guidance:'출발지'};if(type==='roundabout'||type==='rotary')return {type:72,guidance:'회전교차로 진입'};if(type==='uturn'||modifier==='uturn')return {type:3,guidance:'유턴'};if(['left','sharp left'].includes(modifier))return {type:1,guidance:'좌회전'};if(modifier==='slight left')return {type:5,guidance:'왼쪽 방향'};if(['right','sharp right'].includes(modifier))return {type:2,guidance:'우회전'};if(modifier==='slight right')return {type:6,guidance:'오른쪽 방향'};if(type==='off ramp')return modifier?.includes('left')?{type:8,guidance:'왼쪽 출구'}:{type:9,guidance:'오른쪽 출구'};if(type==='on ramp')return modifier?.includes('left')?{type:11,guidance:'왼쪽 진입'}:{type:12,guidance:'오른쪽 진입'};return {type:0,guidance:'직진'};
}
function guideTypeLabel(type){if(type===0)return '직진';if(type===1)return '좌회전';if(type===2)return '우회전';if(type===3)return '유턴';if(type===5)return '왼쪽 방향';if(type===6)return '오른쪽 방향';if(type===7)return '고속도로 출구';if(type===10)return '고속도로 입구';if(type===14)return '고가도로 진입';if(type===15)return '지하차도 진입';if(type===100)return '출발지';if(type===101)return '목적지';if(type===1000)return '경유지';if((type>=30&&type<=41)||(type>=70&&type<=81))return '회전교차로 안내';return '경로 안내'}
function nearestGeometryIndex(lng,lat,geometry){if(!Number.isFinite(lng)||!Number.isFinite(lat)||!geometry?.length)return 0;let bestI=0,best=Infinity;const stride=Math.max(1,Math.floor(geometry.length/1800));for(let i=0;i<geometry.length;i+=stride){const dx=(geometry[i][0]-lng)*Math.cos(lat*Math.PI/180),dy=geometry[i][1]-lat,d=dx*dx+dy*dy;if(d<best){best=d;bestI=i}}const start=Math.max(0,bestI-stride*3),end=Math.min(geometry.length-1,bestI+stride*3);for(let i=start;i<=end;i++){const dx=(geometry[i][0]-lng)*Math.cos(lat*Math.PI/180),dy=geometry[i][1]-lat,d=dx*dx+dy*dy;if(d<best){best=d;bestI=i}}return bestI}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})}
