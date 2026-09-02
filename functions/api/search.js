export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  if (!q) return json({ items: [] });

  const nq = normalize(q);
  const forceKomsco = nq.includes('과학로8067') || nq.includes('대전광역시과학로8067') || nq.includes('대전유성구과학로8067');
  const komscoSearch = nq.includes('한국조폐공사');
  const stationQuery = /역$/.test(nq) && nq.length >= 2;
  const lng=Number(url.searchParams.get('lng')), lat=Number(url.searchParams.get('lat'));
  const hasGps=Number.isFinite(lng)&&Number.isFinite(lat);
  const groupInfo=classifyGroupQuery(q);
  const nearbyCategory=Boolean(groupInfo);
  const searchQ = forceKomsco ? '한국조폐공사 본사' : q;

  if (env.KAKAO_REST_API_KEY) {
    let merged=[];

    // 특정 업종/시설군은 현재 위치 중심 카테고리/키워드 검색 후 거리순 정렬.
    if(nearbyCategory&&hasGps){
      if(groupInfo.categoryCode){
        const categoryItems=await kakaoCategorySearch(groupInfo.categoryCode,lng,lat,env.KAKAO_REST_API_KEY);
        merged=mergeUnique(merged,filterGroupItems(categoryItems,groupInfo,q));
      }
      const keywordItems=await kakaoKeywordSearch(searchQ,env.KAKAO_REST_API_KEY,{lng,lat,sortDistance:true,radius:30000});
      merged=mergeUnique(merged,filterGroupItems(keywordItems,groupInfo,q));
      // 결과가 너무 적으면 필터를 완화하되 거리순은 유지한다.
      if(merged.length<5)merged=mergeUnique(merged,keywordItems);
    }else{
      // 고유 지명은 정확도 우선. 역명은 보조 질의를 추가한다.
      const queries=stationQuery?[searchQ,`${searchQ} 기차역`,`${searchQ} 지하철역`]:buildExactQueries(searchQ);
      for(const query of queries){
        merged=mergeUnique(merged,await kakaoKeywordSearch(query,env.KAKAO_REST_API_KEY,{lng,lat,sortDistance:false}));
        if(merged.length>=25)break;
      }
    }

    // GPS가 있으면 모든 결과에 실제 직선거리(m)를 계산한다. Kakao distance가 빈 값이어도 0m로 오인하지 않는다.
    merged=merged.map(x=>withDistance(x,lng,lat,hasGps));
    let items = nearbyCategory&&hasGps ? rankNearbyResults(merged,lng,lat) : rankNamedResults(merged,q,stationQuery,hasGps);
    items = applyKomscoRules(items, forceKomsco, komscoSearch);
    return json({ provider:'kakao', mode:nearbyCategory?'nearby':'named', items:items.slice(0,10) });
  }

  // API 키가 없는 개발환경 fallback
  const n = new URL('https://nominatim.openstreetmap.org/search');
  n.searchParams.set('format', 'jsonv2');
  n.searchParams.set('limit', '20');
  n.searchParams.set('q', stationQuery ? `${searchQ}, 대한민국` : searchQ);
  n.searchParams.set('accept-language', 'ko');
  n.searchParams.set('countrycodes', 'kr');
  const r = await fetch(n, { headers: { 'User-Agent': 'JofamsNavi/7.5-searchfix' } });
  if (!r.ok) return json({ items: [] }, 502);
  const d = await r.json();
  let items = d.map((x,i)=>withDistance({id:String(x.place_id||i),name:(x.name||x.display_name.split(',')[0]),address:x.display_name,category:x.type,lng:Number(x.lon),lat:Number(x.lat)},lng,lat,hasGps));
  items = nearbyCategory&&hasGps ? rankNearbyResults(items,lng,lat) : rankNamedResults(items,q,stationQuery,hasGps);
  items = applyKomscoRules(items, forceKomsco, komscoSearch);
  return json({ provider:'nominatim', mode:nearbyCategory?'nearby':'named', items:items.slice(0,10) });
}

async function kakaoKeywordSearch(query,key,{lng,lat,sortDistance=false,radius=0}={}){
  const api=new URL('https://dapi.kakao.com/v2/local/search/keyword.json');
  api.searchParams.set('query',query);api.searchParams.set('size','15');
  if(Number.isFinite(lng)&&Number.isFinite(lat)){
    api.searchParams.set('x',String(lng));api.searchParams.set('y',String(lat));
    if(radius)api.searchParams.set('radius',String(radius));
    if(sortDistance)api.searchParams.set('sort','distance');
  }
  const r=await fetch(api,{headers:{Authorization:`KakaoAK ${key}`}});if(!r.ok)return [];
  const d=await r.json();return (d.documents||[]).map(toKakaoItem);
}
async function kakaoCategorySearch(code,lng,lat,key){
  const api=new URL('https://dapi.kakao.com/v2/local/search/category.json');
  api.searchParams.set('category_group_code',code);api.searchParams.set('x',String(lng));api.searchParams.set('y',String(lat));api.searchParams.set('radius','20000');api.searchParams.set('sort','distance');api.searchParams.set('size','15');
  const r=await fetch(api,{headers:{Authorization:`KakaoAK ${key}`}});if(!r.ok)return [];
  const d=await r.json();return (d.documents||[]).map(toKakaoItem);
}
function toKakaoItem(x){return {id:x.id,name:x.place_name,address:x.road_address_name||x.address_name,category:x.category_name,lng:Number(x.x),lat:Number(x.y),url:x.place_url,distance:parseDistance(x.distance)}}
function parseDistance(v){if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)&&n>=0?n:null}
function withDistance(x,lng,lat,hasGps){
  if(!hasGps||!Number.isFinite(Number(x.lat))||!Number.isFinite(Number(x.lng)))return {...x,distance:parseDistance(x.distance)};
  const calc=Math.round(distanceMeters(lat,lng,Number(x.lat),Number(x.lng)));
  const api=parseDistance(x.distance);
  return {...x,distance:Number.isFinite(calc)?calc:api};
}
function mergeUnique(a,b){const out=[...a],seen=new Set(out.map(x=>String(x.id||`${x.name}:${x.lat}:${x.lng}`)));for(const x of b||[]){const k=String(x.id||`${x.name}:${x.lat}:${x.lng}`);if(!seen.has(k)){seen.add(k);out.push(x)}}return out}

function normalize(v=''){return String(v).toLowerCase().replace(/\s+/g,'').replace(/[()\-.,·]/g,'')}
function relaxedNormalize(v=''){
  return normalize(v)
    .replace(/특별시|광역시|특별자치시|특별자치도|도|시청사/g,'')
    .replace(/광역시청/g,'시청')
    .replace(/특별시청/g,'시청');
}
function tokenize(v=''){return String(v).toLowerCase().split(/[\s,()\-·/]+/).map(normalize).filter(x=>x.length>=2)}
function buildExactQueries(q){
  const out=[q];
  if(/시청$/.test(q)&&!/광역시청|특별시청/.test(q))out.push(q.replace(/시청$/,'광역시청'));
  if(/도청$/.test(q))out.push(q.replace(/도청$/,'도청 본청'));
  return [...new Set(out)];
}
function rankNamedResults(items,query,stationQuery,hasGps){
  const nq=normalize(query),rq=relaxedNormalize(query),tokens=tokenize(query);
  const stationWords=/역|철도|기차|지하철|rail|station|subway/i;
  return items.map((x,idx)=>{
    const nn=normalize(x.name),rn=relaxedNormalize(x.name),na=normalize(x.address),cat=String(x.category||'');
    let score=0;
    // 정확 지명 일치를 압도적으로 최우선
    if(nn===nq)score+=5000;
    if(rn===rq)score+=4200;
    if(nn.startsWith(nq))score+=2600;
    if(nn.includes(nq))score+=2200;
    if(rn.startsWith(rq))score+=1800;
    if(rn.includes(rq))score+=1500;
    if(na.includes(nq))score+=500;
    const tokenHits=tokens.filter(t=>nn.includes(t)||na.includes(t)).length;
    score+=tokenHits*260;
    if(tokens.length&&tokenHits===tokens.length)score+=500;
    if(stationQuery&&stationWords.test(`${x.name} ${cat}`))score+=600;
    if(stationQuery&&!nn.includes(nq)&&!rn.includes(rq))score-=900;
    // 검색어와 무관한 유사 업체가 상단으로 치고 올라오는 것을 방지
    if(!nn.includes(nq)&&!rn.includes(rq)&&!na.includes(nq)&&tokenHits===0)score-=1200;
    // 동일 정확도에서는 가까운 장소를 보조 기준으로만 사용
    const dist=hasGps&&Number.isFinite(Number(x.distance))?Number(x.distance):99999999;
    return {...x,_score:score,_idx:idx,_dist:dist};
  }).sort((a,b)=>b._score-a._score||a._dist-b._dist||a._idx-b._idx).map(({_score,_idx,_dist,...x})=>x);
}

function classifyGroupQuery(q=''){
  const n=normalize(q).replace(/내주변|주변|근처|가까운/g,'');
  const defs=[
    {re:/^(편의점)$/,categoryCode:'CS2',keywords:/편의점|씨유|cu|gs25|세븐일레븐|이마트24|ministop/i},
    {re:/^(주유소|충전소|전기차충전소|ev충전소)$/,categoryCode:'OL7',keywords:/주유소|충전소|전기차|ev/i},
    {re:/^(주차장|공영주차장|공용주차장)$/,categoryCode:'PK6',keywords:/주차장|parking/i},
    {re:/^(마트|대형마트|슈퍼|슈퍼마켓)$/,categoryCode:'MT1',keywords:/마트|슈퍼|market/i},
    {re:/^(경찰서|파출소|지구대)$/,categoryCode:'PO3',keywords:/경찰서|파출소|지구대|경찰/i},
    {re:/^(소방서|119안전센터|안전센터)$/,categoryCode:'PO3',keywords:/소방서|119|안전센터|소방/i},
    {re:/^(공용화장실|공중화장실|화장실)$/,categoryCode:null,keywords:/공중화장실|공용화장실|화장실/i},
    {re:/^(공공기관|관공서)$/,categoryCode:'PO3',keywords:/시청|구청|군청|도청|주민센터|행정복지센터|공사|공단|공공/i},
  ];
  return defs.find(d=>d.re.test(n))||null;
}
function filterGroupItems(items,group,q){if(!group?.keywords)return items;const filtered=items.filter(x=>group.keywords.test(`${x.name||''} ${x.category||''}`));return filtered.length?filtered:items}
function rankNearbyResults(items,lng,lat){
  return items.map((x,idx)=>{const calc=Number.isFinite(Number(x.lat))&&Number.isFinite(Number(x.lng))?distanceMeters(lat,lng,Number(x.lat),Number(x.lng)):Infinity;const d=Number.isFinite(calc)?Math.round(calc):parseDistance(x.distance);return {...x,distance:d,_idx:idx}}).sort((a,b)=>(a.distance??Infinity)-(b.distance??Infinity)||a._idx-b._idx).map(({_idx,...x})=>x);
}
function distanceMeters(lat1,lon1,lat2,lon2){const R=6371000,p=Math.PI/180,a=Math.sin((lat2-lat1)*p/2)**2+Math.cos(lat1*p)*Math.cos(lat2*p)*Math.sin((lon2-lon1)*p/2)**2;return 2*R*Math.asin(Math.sqrt(a))}
function applyKomscoRules(items,forceKomsco,komscoSearch){
  const hqIndex=items.findIndex(x=>(/본사/.test(x.name||'')&&/한국조폐공사/.test(x.name||''))||/과학로\s*80-67/.test(x.address||''));
  if(forceKomsco){const picked=hqIndex>=0?items[hqIndex]:(items.find(x=>/한국조폐공사/.test(x.name||''))||items[0]);return picked?[{...picked,name:'한국조폐공사 본사',address:'대전광역시 유성구 과학로 80-67'}]:[]}
  if(komscoSearch&&hqIndex>=0){const out=[...items],[hq]=out.splice(hqIndex,1);out.unshift({...hq,name:'한국조폐공사 본사',address:hq.address||'대전광역시 유성구 과학로 80-67'});return out}
  return items;
}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})}
