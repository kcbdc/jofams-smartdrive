// Current-position weather for the Dangollo home header. Separate from Opinet and AI.
// Data: Open-Meteo (attribution required); API is for non-commercial usage under provider terms.
const json=(obj,status=200,ttl=0)=>new Response(JSON.stringify(obj),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':ttl?`public, max-age=${ttl}`:'no-store','x-content-type-options':'nosniff'}});
function kindFor(code){if(code===0)return['clear','맑음'];if([1,2].includes(code))return['partly','구름 조금'];if(code===3)return['cloud','흐림'];if([45,48].includes(code))return['fog','안개'];if([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code))return['rain','비'];if([71,73,75,77,85,86].includes(code))return['snow','눈'];if([95,96,99].includes(code))return['storm','뇌우'];return['cloud','날씨'];}
export async function onRequestGet({request}){
  const u=new URL(request.url),lat=Number(u.searchParams.get('lat')),lng=Number(u.searchParams.get('lng'));
  if(!u.searchParams.has('lat')||!u.searchParams.has('lng')||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return json({error:'invalid coordinates'},400);
  // Round to roughly neighborhood resolution so requests can share CDN caches.
  const api=new URL('https://api.open-meteo.com/v1/forecast');
  api.searchParams.set('latitude',lat.toFixed(2));api.searchParams.set('longitude',lng.toFixed(2));
  api.searchParams.set('current','temperature_2m,weather_code,is_day');api.searchParams.set('timezone','auto');
  let res;
  try{res=await fetch(api.toString(),{cf:{cacheTtl:600,cacheEverything:true},headers:{accept:'application/json'},signal:AbortSignal.timeout(5500)})}catch{return json({error:'weather upstream timeout'},502)}
  if(!res.ok)return json({error:'weather upstream unavailable'},502);
  let data;try{data=await res.json()}catch{return json({error:'weather response error'},502)}
  const cur=data?.current,t=Number(cur?.temperature_2m),code=Number(cur?.weather_code);
  if(cur?.temperature_2m==null||!Number.isFinite(t)||!Number.isFinite(code))return json({error:'weather data unavailable'},502);
  const [kind,label]=kindFor(code);
  return json({temperature:Math.round(t*10)/10,kind,label,isDay:Number(cur.is_day)===1,observedAt:cur.time||null,source:'Open-Meteo'},200,300);
}
