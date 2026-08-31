export async function onRequestGet({request,env}){
  const u=new URL(request.url),lng=Number(u.searchParams.get('lng')),lat=Number(u.searchParams.get('lat')),radius=Math.min(5000,Math.max(300,Number(u.searchParams.get('radius'))||1800));
  if(!Number.isFinite(lng)||!Number.isFinite(lat))return json({items:[]},400);
  if(env.KAKAO_REST_API_KEY){
    const api=new URL('https://dapi.kakao.com/v2/local/search/category.json');api.searchParams.set('category_group_code','PK6');api.searchParams.set('x',lng);api.searchParams.set('y',lat);api.searchParams.set('radius',radius);api.searchParams.set('sort','distance');api.searchParams.set('size','10');
    const r=await fetch(api,{headers:{Authorization:`KakaoAK ${env.KAKAO_REST_API_KEY}`}});if(r.ok){const d=await r.json();return json({provider:'kakao',items:(d.documents||[]).map(x=>({id:x.id,name:x.place_name,address:x.road_address_name||x.address_name,phone:x.phone||'',lng:Number(x.x),lat:Number(x.y),distance:Number(x.distance)||0,url:x.place_url||''}))})}
  }
  try{
    const delta=Math.min(.04,radius/85000),n=new URL('https://nominatim.openstreetmap.org/search');n.searchParams.set('format','jsonv2');n.searchParams.set('limit','8');n.searchParams.set('q','parking');n.searchParams.set('accept-language','ko');n.searchParams.set('bounded','1');n.searchParams.set('viewbox',`${lng-delta},${lat+delta},${lng+delta},${lat-delta}`);
    const r=await fetch(n,{headers:{'User-Agent':'JofamsSmartDrive/4.0 (prototype)'}});if(!r.ok)return json({items:[]});const d=await r.json();return json({provider:'nominatim',items:d.map((x,i)=>({id:String(x.place_id||i),name:x.name||'주차장',address:x.display_name||'',lng:Number(x.lon),lat:Number(x.lat),distance:haversine(lat,lng,Number(x.lat),Number(x.lon))}))});
  }catch{return json({items:[]})}
}
function haversine(lat1,lon1,lat2,lon2){const R=6371000,p=Math.PI/180,a=Math.sin((lat2-lat1)*p/2)**2+Math.cos(lat1*p)*Math.cos(lat2*p)*Math.sin((lon2-lon1)*p/2)**2;return 2*R*Math.asin(Math.sqrt(a))}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=60'}})}
