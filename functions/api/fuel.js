const JSON_HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=120'};

export async function onRequestGet({request,env}){
  const url=new URL(request.url);
  const lat=Number(url.searchParams.get('lat')),lng=Number(url.searchParams.get('lng'));
  const prodcd=validProduct(url.searchParams.get('prodcd')||'B027');
  const cnt=Math.max(1,Math.min(20,Number(url.searchParams.get('cnt'))||8));
  if(!Number.isFinite(lat)||!Number.isFinite(lng))return json({error:'lat/lng가 필요합니다.'},400);
  if(!env.OPINET_CERT_KEY)return json({error:'OPINET_CERT_KEY가 설정되지 않았습니다.',setup:'Cloudflare Pages Secret에 오피넷 인증키를 등록하세요.'},503);

  try{
    const region=await kakaoRegion(lat,lng,env.KAKAO_REST_API_KEY);
    const area=await resolveOpinetArea(region,env.OPINET_CERT_KEY);
    const areaCode=area.sigunCode||area.sidoCode||'';
    const [stations,avg]=await Promise.all([
      opinetLow(areaCode,prodcd,cnt,env.OPINET_CERT_KEY),
      area.sidoCode?opinetAverage(area.sidoCode,area.sigunCode,prodcd,env.OPINET_CERT_KEY):Promise.resolve(null)
    ]);
    const detailed=await enrichStationAddresses(stations.slice(0,8),env.OPINET_CERT_KEY);
    return json({
      provider:'opinet',
      product:prodcd,
      productName:productName(prodcd),
      areaName:[region?.region1,region?.region2].filter(Boolean).join(' ')||area.sigunName||area.sidoName||'현재 지역',
      areaCode,
      averagePrice:avg,
      updatedAt:new Date().toISOString(),
      stations:detailed
    });
  }catch(e){
    return json({error:e?.message||'오피넷 유가 조회에 실패했습니다.'},502);
  }
}

function validProduct(v){return ['B027','D047','B034','K015'].includes(v)?v:'B027'}
function productName(v){return ({B027:'휘발유',D047:'경유',B034:'고급휘발유',K015:'LPG'})[v]||v}
async function fetchJson(url,headers={}){
  const r=await fetch(url,{headers});
  if(!r.ok)throw new Error(`외부 API 오류 (${r.status})`);
  const text=await r.text();
  try{return JSON.parse(text)}catch{throw new Error('외부 API 응답 형식 오류')}
}
async function kakaoRegion(lat,lng,key){
  if(!key)return null;
  const u=new URL('https://dapi.kakao.com/v2/local/geo/coord2regioncode.json');
  u.searchParams.set('x',lng);u.searchParams.set('y',lat);
  const d=await fetchJson(u,{Authorization:`KakaoAK ${key}`});
  const doc=(d.documents||[]).find(x=>x.region_type==='H')||(d.documents||[])[0];
  if(!doc)return null;
  return {region1:doc.region_1depth_name||'',region2:doc.region_2depth_name||'',region3:doc.region_3depth_name||''};
}
async function opinet(endpoint,params,key){
  const u=new URL(`https://www.opinet.co.kr/api/${endpoint}`);
  u.searchParams.set('out','json');u.searchParams.set('certkey',key);
  for(const [k,v] of Object.entries(params||{}))if(v!==''&&v!=null)u.searchParams.set(k,String(v));
  return fetchJson(u);
}
function rows(d){
  const r=d?.RESULT?.OIL??d?.RESULT?.AREA??d?.RESULT??[];
  return Array.isArray(r)?r:r?[r]:[];
}
function normName(s=''){return String(s).replace(/특별자치시|특별자치도|특별시|광역시|도|시|군|구|\s/g,'').toLowerCase()}
async function resolveOpinetArea(region,key){
  const sidoRows=rows(await opinet('areaCode.do',{},key));
  let sido=null,sigun=null;
  if(region?.region1){
    const n=normName(region.region1);
    sido=sidoRows.find(x=>normName(x.AREA_NM)===n)||sidoRows.find(x=>n.includes(normName(x.AREA_NM))||normName(x.AREA_NM).includes(n));
  }
  if(!sido&&sidoRows.length===1)sido=sidoRows[0];
  if(sido&&region?.region2){
    const sigunRows=rows(await opinet('areaCode.do',{area:sido.AREA_CD},key));
    const n=normName(region.region2);
    sigun=sigunRows.find(x=>normName(x.AREA_NM)===n)||sigunRows.find(x=>n.includes(normName(x.AREA_NM))||normName(x.AREA_NM).includes(n));
  }
  return {
    sidoCode:sido?.AREA_CD||'',sidoName:sido?.AREA_NM||region?.region1||'',
    sigunCode:sigun?.AREA_CD||'',sigunName:sigun?.AREA_NM||region?.region2||''
  };
}
async function opinetLow(area,prodcd,cnt,key){
  const d=await opinet('lowTop10.do',{prodcd,area,cnt},key);
  return rows(d).map(x=>({
    id:x.UNI_ID||x.OS_ID||'',
    name:x.OS_NM||x.OS_NM_KOR||'주유소',
    price:Number(x.PRICE)||0,
    brand:x.POLL_DIV_CD||'',
    address:x.NEW_ADR||x.VAN_ADR||''
  })).filter(x=>x.price>0).sort((a,b)=>a.price-b.price);
}
async function opinetAverage(sido,sigun,prodcd,key){
  try{
    const d=await opinet('avgSigunPrice.do',{sido,sigun,prodcd},key);
    const found=rows(d).find(x=>!x.PRODCD||x.PRODCD===prodcd)||rows(d)[0];
    return Number(found?.PRICE)||null;
  }catch{return null}
}
async function enrichStationAddresses(items,key){
  return Promise.all(items.map(async x=>{
    if(!x.id||x.address)return x;
    try{
      const d=await opinet('detailById.do',{id:x.id},key);
      const row=rows(d)[0]||{};
      return {...x,name:row.OS_NM||x.name,brand:row.POLL_DIV_CD||x.brand,address:row.NEW_ADR||row.VAN_ADR||x.address};
    }catch{return x}
  }));
}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:JSON_HEADERS})}
