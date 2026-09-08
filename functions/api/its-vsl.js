
const H={'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=30'};
export async function onRequestGet({request,env}){
  const u=new URL(request.url),lng=Number(u.searchParams.get('lng')),lat=Number(u.searchParams.get('lat'));
  const key=String(env.ITS_API_KEY||env.ITS_OPEN_API_KEY||env.NATIONAL_TRAFFIC_API_KEY||'').trim();
  if(!key)return json({ok:false,code:'ITS_VSL_KEY_MISSING',items:[]},503);
  if(!Number.isFinite(lat)||!Number.isFinite(lng))return json({ok:false,code:'INVALID_COORDINATES',items:[]},400);
  const base=String(env.ITS_VSL_API_URL||'https://openapi.its.go.kr:9443/variableSpeed').trim();
  try{
    const q=new URL(base);q.searchParams.set('apiKey',key);q.searchParams.set('type','all');q.searchParams.set('getType','json');
    q.searchParams.set('minX',String(lng-.12));q.searchParams.set('maxX',String(lng+.12));q.searchParams.set('minY',String(lat-.12));q.searchParams.set('maxY',String(lat+.12));
    const r=await fetch(q,{headers:{accept:'application/json'}}),text=await r.text();if(!r.ok)throw new Error(`HTTP ${r.status}`);
    let d;try{d=JSON.parse(text)}catch{throw new Error('invalid JSON')}
    let rows=d?.body?.items||d?.body||d?.items||d?.data||[];if(!Array.isArray(rows))rows=rows?[rows]:[];
    const items=rows.map(x=>({speedLimit:Number(x.speedLimit??x.limitSpeed??x.vslSpeed??x.speed),lng:Number(x.coordx??x.longitude??x.lng??x.x),lat:Number(x.coordy??x.latitude??x.lat??x.y),roadName:String(x.roadName??x.roadnametext??''),roadSectionId:String(x.roadsectionid??x.linkId??'')})).filter(x=>Number.isFinite(x.speedLimit)&&x.speedLimit>0);
    return json({ok:true,items});
  }catch(e){return json({ok:false,code:'ITS_VSL_UPSTREAM_ERROR',detail:String(e?.message||e),items:[]},502)}
}
function json(x,s=200){return new Response(JSON.stringify(x),{status:s,headers:H})}
