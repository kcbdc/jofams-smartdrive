export async function onRequestGet({request,env}){
  const apiKey=String(env.ITS_API_KEY||'').trim();
  if(!apiKey)return json({ok:false,configured:false,error:'ITS_API_KEY is not configured'},503);
  const q=new URL(request.url);
  const minX=num(q.searchParams.get('minX')),maxX=num(q.searchParams.get('maxX'));
  const minY=num(q.searchParams.get('minY')),maxY=num(q.searchParams.get('maxY'));
  if(![minX,maxX,minY,maxY].every(Number.isFinite))return json({ok:false,error:'invalid bounds'},400);

  const u=new URL('https://openapi.its.go.kr/trafficInfo');
  u.searchParams.set('apiKey',apiKey);
  u.searchParams.set('type','all');
  u.searchParams.set('minX',String(minX));u.searchParams.set('maxX',String(maxX));
  u.searchParams.set('minY',String(minY));u.searchParams.set('maxY',String(maxY));
  u.searchParams.set('getType','json');

  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),7000);
  try{
    const r=await fetch(u,{signal:ctrl.signal,headers:{accept:'application/json'}});
    const text=await r.text();
    if(!r.ok)return json({ok:false,error:`ITS HTTP ${r.status}`},502);
    let d;try{d=JSON.parse(text)}catch{return json({ok:false,error:'ITS invalid JSON'},502)}
    const items=extractItems(d).map(x=>({
      roadName:String(x.roadName??x.roadnametext??''),
      linkId:String(x.linkId??x.roadsectionid??''),
      speed:num(x.speed),
      travelTime:num(x.travelTime??x.traveltime),
      createdDate:String(x.createdDate??x.createddate??'')
    })).filter(x=>x.roadName||x.linkId);
    return json({ok:true,configured:true,provider:'국가교통정보센터 교통소통정보',items},200,15);
  }catch(e){
    return json({ok:false,error:e?.name==='AbortError'?'ITS timeout':String(e?.message||e)},502);
  }finally{clearTimeout(timer)}
}
function extractItems(d){
  const c=[d?.body?.items,d?.body?.items?.item,d?.response?.body?.items,d?.response?.body?.items?.item,d?.items,d?.item,d?.body?.item];
  for(const x of c){if(Array.isArray(x))return x;if(x&&typeof x==='object'&&Array.isArray(x.item))return x.item}
  return [];
}
function num(v){const n=Number(v);return Number.isFinite(n)?n:NaN}
function json(data,status=200,maxAge=0){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':maxAge?`public, max-age=${maxAge}`:'no-store'}})}
