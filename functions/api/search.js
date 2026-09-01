export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  if (!q) return json({ items: [] });

  const nq = normalize(q);
  const forceKomsco = nq.includes('과학로8067') || nq.includes('대전광역시과학로8067') || nq.includes('대전유성구과학로8067');
  const komscoSearch = nq.includes('한국조폐공사');
  const stationQuery = /역$/.test(nq) && nq.length >= 2;
  const searchQ = forceKomsco ? '한국조폐공사 본사' : q;

  if (env.KAKAO_REST_API_KEY) {
    const queries = stationQuery ? [searchQ, `${searchQ} 기차역`, `${searchQ} 지하철역`] : [searchQ];
    const merged = [];
    for (const query of queries) {
      const api = new URL('https://dapi.kakao.com/v2/local/search/keyword.json');
      api.searchParams.set('query', query);
      api.searchParams.set('size', '15');
      // 텍스트 검색에서는 현재 위치 거리순을 강제하지 않는다. 정확도순이 우선이다.
      const r = await fetch(api, { headers: { Authorization: `KakaoAK ${env.KAKAO_REST_API_KEY}` } });
      if (!r.ok) continue;
      const d = await r.json();
      for (const x of d.documents || []) {
        const item = { id:x.id, name:x.place_name, address:x.road_address_name || x.address_name, category:x.category_name, lng:Number(x.x), lat:Number(x.y), url:x.place_url };
        if (!merged.some(v => String(v.id) === String(item.id))) merged.push(item);
      }
      if (merged.length >= 15) break;
    }
    let items = rankResults(merged, q, stationQuery);
    items = applyKomscoRules(items, forceKomsco, komscoSearch);
    return json({ provider:'kakao', items:items.slice(0,10) });
  }

  // API 키가 없는 개발 환경 fallback: 한국 검색 정확도를 높이기 위해 KR 범위 + 한국어 요청.
  const n = new URL('https://nominatim.openstreetmap.org/search');
  n.searchParams.set('format', 'jsonv2');
  n.searchParams.set('limit', '15');
  n.searchParams.set('q', stationQuery ? `${searchQ}, 대한민국` : searchQ);
  n.searchParams.set('accept-language', 'ko');
  n.searchParams.set('countrycodes', 'kr');
  const r = await fetch(n, { headers: { 'User-Agent': 'JofamsSmartDrive/6.6 (prototype)' } });
  if (!r.ok) return json({ items: [] }, 502);
  const d = await r.json();
  let items = d.map((x,i)=>({id:String(x.place_id||i),name:(x.name||x.display_name.split(',')[0]),address:x.display_name,category:x.type,lng:Number(x.lon),lat:Number(x.lat)}));
  items = rankResults(items, q, stationQuery);
  items = applyKomscoRules(items, forceKomsco, komscoSearch);
  return json({ provider:'nominatim', items:items.slice(0,10) });
}

function normalize(v=''){return String(v).toLowerCase().replace(/\s+/g,'').replace(/[()\-.,·]/g,'')}
function rankResults(items, query, stationQuery){
  const nq=normalize(query);
  const stationWords=/역|철도|기차|지하철|rail|station|subway/i;
  return items.map((x,idx)=>{
    const nn=normalize(x.name), na=normalize(x.address), cat=String(x.category||'');
    let score=0;
    if(nn===nq) score+=1000;
    if(nn.startsWith(nq)) score+=600;
    if(nn.includes(nq)) score+=420;
    if(na.includes(nq)) score+=100;
    if(stationQuery && stationWords.test(`${x.name} ${cat}`)) score+=260;
    if(stationQuery && !nn.includes(nq)) score-=320;
    // 검색어의 핵심 토큰이 이름에 없는 결과가 상단으로 올라오는 것을 방지
    if(!nn.includes(nq) && !na.includes(nq)) score-=180;
    return {...x,_score:score,_idx:idx};
  }).sort((a,b)=>b._score-a._score || a._idx-b._idx).map(({_score,_idx,...x})=>x);
}
function applyKomscoRules(items, forceKomsco, komscoSearch){
  const hqIndex = items.findIndex(x => (/본사/.test(x.name||'') && /한국조폐공사/.test(x.name||'')) || /과학로\s*80-67/.test(x.address||''));
  if (forceKomsco) {
    const picked = hqIndex >= 0 ? items[hqIndex] : (items.find(x => /한국조폐공사/.test(x.name||'')) || items[0]);
    return picked ? [{...picked,name:'한국조폐공사 본사',address:'대전광역시 유성구 과학로 80-67'}] : [];
  }
  if (komscoSearch && hqIndex >= 0) {
    const out=[...items], [hq]=out.splice(hqIndex,1);
    out.unshift({...hq,name:'한국조폐공사 본사',address:hq.address||'대전광역시 유성구 과학로 80-67'});
    return out;
  }
  return items;
}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})}
