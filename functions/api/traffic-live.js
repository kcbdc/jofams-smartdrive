// National Traffic Information Center: highway/national road observed speed.
// Cloudflare Pages secret: ITS_API_KEY. Never expose secret in client JavaScript.
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
function parseRecords(d){const candidates=[d?.body?.items,d?.body?.items?.item,d?.response?.body?.items?.item,d?.response?.body?.items,d?.items,d?.data,d?.list,d?.response?.data];for(const x of candidates){if(Array.isArray(x))return x;if(x&&typeof x==='object'){if(Array.isArray(x.item))return x.item;if(Array.isArray(x.data))return x.data}}return []}
// Keep the provider observation time separate from the time this endpoint was called.
function observationTime(a){
 const v=a.createDate??a.createdDate??a.collectDate??a.collDate??a.procDate??a.observedAt??a.timestamp??a.date;
 if(v==null||String(v).trim()==='')return null;
 const str=String(v).trim();
 let t;
 if(/^\d{14}$/.test(str))t=Date.parse(`${str.slice(0,4)}-${str.slice(4,6)}-${str.slice(6,8)}T${str.slice(8,10)}:${str.slice(10,12)}:${str.slice(12,14)}+09:00`);
 else if(/^\d{12}$/.test(str))t=Date.parse(`${str.slice(0,4)}-${str.slice(4,6)}-${str.slice(6,8)}T${str.slice(8,10)}:${str.slice(10,12)}:00+09:00`);
 else if(/^\d{8}$/.test(str))t=Date.parse(`${str.slice(0,4)}-${str.slice(4,6)}-${str.slice(6,8)}T00:00:00+09:00`);
 else t=Date.parse(str.replace(' ','T') + (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(str.replace(' ','T'))?'+09:00':''));
 return Number.isFinite(t)?new Date(t).toISOString():null;
}
function groupRows(list){
 const result=[], seen=new Set(), now=Date.now();
 const stats={totalRaw:list.length,stale:0,unknownTime:0,invalid:0};
 for(const a of list){
  if(!a||typeof a!=='object'){stats.invalid++;continue}
  const speed=Number(a.speed??a.trvlSpeed??a.avgSpeed??a.spd);
  const road=String(a.roadName??a.routeName??a.routeNm??a.roadNm??'').trim();
  if(!Number.isFinite(speed)||speed<=0||speed>180||!road||road==='-'){stats.invalid++;continue}
  const at=observationTime(a);
  if(at&&(now-Date.parse(at)>20*60000||Date.parse(at)-now>5*60000)){stats.stale++;continue}
  if(!at)stats.unknownTime++;
  const dir=String(a.drcType??a.direction??a.routeWay??'').trim();
  const id=String(a.linkId??a.linkID??a.link_id??a.roadLinkId??'').trim();
  const key=id?`${id}|${dir}`:`${road}|${dir}|${Math.round(speed/5)}`;
  if(seen.has(key))continue;seen.add(key);
  const high=/고속|express|ex\b/i.test(road)||String(a.roadType??'').toLowerCase()==='ex';
  // Speed-only classes are estimates, not the provider's official congestion grade.
  const level=high?(speed>=80?'원활':speed>=50?'서행':speed>=30?'지체':'정체'):(speed>=50?'원활':speed>=30?'서행':speed>=15?'지체':'정체');
  result.push({road:road.slice(0,72),direction:dir.slice(0,28),speed:Math.round(speed),level,at,verified:!!at});
 }
 const counts={원활:0,서행:0,지체:0,정체:0,시각미확인:0};
 for(const r of result){if(r.verified)counts[r.level]++;else counts.시각미확인++}
 // Never sort 'jam' first before calculating the summary or selecting displayed results.
 result.sort((a,b)=>Number(b.verified)-Number(a.verified)||String(a.road).localeCompare(String(b.road),'ko'));
 return {items:result.slice(0,60),counts,stats,total:result.length,limited:result.length>60};
}
export async function onRequestGet({request,env}){
 const u=new URL(request.url);const lat=Number(u.searchParams.get('lat')),lng=Number(u.searchParams.get('lng')),km=Math.min(15,Math.max(2,Number(u.searchParams.get('km'))||7));
 if(!u.searchParams.has('lat')||!u.searchParams.has('lng')||!Number.isFinite(lat)||!Number.isFinite(lng)||lat<33||lat>39||lng<124||lng>132)return reply({message:'올바른 국내 위치가 아닙니다.'},400);
 const key=String(env.ITS_API_KEY||'').trim();if(!key)return reply({message:'교통정보 연동을 위해 Cloudflare 환경변수 ITS_API_KEY를 등록해 주세요.',code:'KEY_REQUIRED'},503);
 const dlat=km/111,dlong=km/(111*Math.max(.5,Math.cos(lat*Math.PI/180)));
 const api=new URL('https://openapi.its.go.kr:9443/trafficInfo');api.searchParams.set('apiKey',key);api.searchParams.set('type','all');api.searchParams.set('drcType','all');api.searchParams.set('minX',(lng-dlong).toFixed(5));api.searchParams.set('maxX',(lng+dlong).toFixed(5));api.searchParams.set('minY',(lat-dlat).toFixed(5));api.searchParams.set('maxY',(lat+dlat).toFixed(5));api.searchParams.set('getType','json');
 let res;try{res=await fetch(api.toString(),{headers:{accept:'application/json'},signal:AbortSignal.timeout(7500),cf:{cacheTtl:80,cacheEverything:true}})}catch{return reply({message:'국가교통정보센터 서버 연결이 지연되고 있습니다.'},502)}
 if(!res.ok)return reply({message:`교통정보 제공기관 응답 오류 (${res.status}). 인증키와 API 승인 상태를 확인해 주세요.`},502);
 let raw;try{raw=await res.json()}catch{return reply({message:'교통정보 응답 형식이 올바르지 않습니다.'},502)}
 const code=String(raw?.response?.header?.resultCode??raw?.result?.resultCode??raw?.resultCode??'');if(code&&code!=='00'&&code!=='0'&&code!=='200')return reply({message:'제공기관에서 조회를 거절했습니다. ITS_API_KEY 승인 상태를 확인해 주세요.'},502);
 const result=groupRows(parseRecords(raw));return reply({...result,source:'국가교통정보센터(국토교통부)',retrievedAt:new Date().toISOString(),classification:'속도기준 참고 분류',note:'자료 수집시각 미확인 구간은 현재 소통현황 집계에서 제외'});
}
