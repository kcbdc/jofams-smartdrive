export async function onRequestGet({request,env}){
  const url=new URL(request.url),lng=Number(url.searchParams.get('lng')),lat=Number(url.searchParams.get('lat'));
  if(!Number.isFinite(lng)||!Number.isFinite(lat))return json({error:'invalid coordinates'},400);
  if(env.KAKAO_REST_API_KEY){
    const u=new URL('https://dapi.kakao.com/v2/local/geo/coord2address.json');
    u.searchParams.set('x',String(lng));u.searchParams.set('y',String(lat));u.searchParams.set('input_coord','WGS84');
    const r=await fetch(u,{headers:{Authorization:`KakaoAK ${env.KAKAO_REST_API_KEY}`}});
    if(r.ok){
      const d=await r.json(),doc=d.documents?.[0],road=doc?.road_address,address=doc?.address;
      const name=road?.building_name||road?.road_name||address?.address_name||'지도에서 선택한 위치';
      return json({item:{name,address:road?.address_name||address?.address_name||'',lng,lat}});
    }
  }
  return json({item:{name:'지도에서 선택한 위치',address:'지도 좌표',lng,lat}});
}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})}
