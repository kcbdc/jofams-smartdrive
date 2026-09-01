export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  if (!q) return json({ items: [] });
  const normalized = q.toLowerCase().replace(/\s+/g, '').replace(/[()\-.,]/g, '');
  const forceKomsco = normalized.includes('과학로8067') || normalized.includes('대전광역시과학로8067') || normalized.includes('대전유성구과학로8067');
  const searchQ = forceKomsco ? '한국조폐공사 본사' : q;
  const lng = url.searchParams.get('lng');
  const lat = url.searchParams.get('lat');

  if (env.KAKAO_REST_API_KEY) {
    const api = new URL('https://dapi.kakao.com/v2/local/search/keyword.json');
    api.searchParams.set('query', searchQ);
    api.searchParams.set('size', '10');
    if (lng && lat) { api.searchParams.set('x', lng); api.searchParams.set('y', lat); api.searchParams.set('sort', 'distance'); }
    const r = await fetch(api, { headers: { Authorization: `KakaoAK ${env.KAKAO_REST_API_KEY}` } });
    if (r.ok) {
      const d = await r.json();
      let items = d.documents.map(x => ({ id:x.id, name:x.place_name, address:x.road_address_name || x.address_name, category:x.category_name, lng:Number(x.x), lat:Number(x.y), url:x.place_url }));
      if (forceKomsco) {
        const picked = items.find(x => /한국조폐공사/.test(x.name) || /과학로 80-67/.test(x.address)) || items[0] || { id:'komsco_hq', name:'한국조폐공사 본사', address:'대전광역시 유성구 과학로 80-67', lng:127.3847, lat:36.3784 };
        items = [{ ...picked, name:'한국조폐공사 본사', address:'대전광역시 유성구 과학로 80-67' }];
      }
      return json({ provider: 'kakao', items });
    }
  }

  // 개발·데모 fallback. 운영 환경에서는 상용 검색 API 사용을 권장합니다.
  const n = new URL('https://nominatim.openstreetmap.org/search');
  n.searchParams.set('format', 'jsonv2'); n.searchParams.set('limit', '8'); n.searchParams.set('q', searchQ); n.searchParams.set('accept-language', 'ko');
  const r = await fetch(n, { headers: { 'User-Agent': 'JofamsSmartDrive/1.0 (prototype)' } });
  if (!r.ok) return json({ items: [] }, 502);
  const d = await r.json();
  let items = d.map((x,i)=>({id:String(x.place_id||i),name:(x.name||x.display_name.split(',')[0]),address:x.display_name,category:x.type,lng:Number(x.lon),lat:Number(x.lat)}));
  if (forceKomsco) {
    const picked = items.find(x => /한국조폐공사/.test(x.name) || /과학로 80-67/.test(x.address)) || items[0] || { id:'komsco_hq', name:'한국조폐공사 본사', address:'대전광역시 유성구 과학로 80-67', lng:127.3847, lat:36.3784 };
    items = [{ ...picked, name:'한국조폐공사 본사', address:'대전광역시 유성구 과학로 80-67' }];
  }
  return json({ provider:'nominatim', items });
}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})}
