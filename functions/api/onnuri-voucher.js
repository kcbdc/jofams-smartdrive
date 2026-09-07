const JSON_HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=300'};
const OFFICIAL_ONNURI_2025_URL='https://api.odcloud.kr/api/3060079/v1/uddi:7ffa42f8-01d1-4329-aa94-aefb67c53cf1';

export async function onRequestGet({request,env}){
  const q=new URL(request.url);
  const west=num(q.searchParams.get('west')),south=num(q.searchParams.get('south'));
  const east=num(q.searchParams.get('east')),north=num(q.searchParams.get('north'));
  const lng=num(q.searchParams.get('lng')),lat=num(q.searchParams.get('lat'));
  const source=String(env.ONNURI_MERCHANT_DATA_URL||OFFICIAL_ONNURI_2025_URL).trim();
  const serviceKey=normalizeServiceKey(env.PUBLIC_DATA_SERVICE_KEY||env.DATA_GO_KR_SERVICE_KEY||env.ONNURI_SERVICE_KEY||'');
  const kakaoKey=String(env.KAKAO_REST_API_KEY||'').trim();

  if(!serviceKey)return json({ok:false,configured:false,code:'ONNURI_KEY_MISSING',error:'공공데이터포털 인증키가 서버에 연결되지 않았습니다.',required:'PUBLIC_DATA_SERVICE_KEY'},503);

  try{
    const region=await resolveRegion(lat,lng,kakaoKey);
    const regionWords=[region?.district,region?.city].filter(Boolean);
    const locality=region?.district||region?.city||'';
    let rows=[],fetchMeta={mode:'none',pages:0,totalCount:0,query:''};

    if(/api\.odcloud\.kr/i.test(new URL(source).hostname) && locality){
      const filtered=await fetchOdcloudFiltered(source,serviceKey,locality);
      rows=filtered.rows;fetchMeta=filtered.meta;
      if(!rows.length && region?.city){
        const byCity=await fetchOdcloudFiltered(source,serviceKey,region.city);
        rows=byCity.rows;fetchMeta={...byCity.meta,fallback:'city'};
      }
    }
    if(!rows.length){
      const all=await fetchOdcloudAllPages(source,serviceKey,{maxPages:120,perPage:1000,regionWords});
      rows=all.rows;fetchMeta=all.meta;
    }

    const normalized=rows.map(row=>({
      raw:row,
      id:String(pick(row,['가맹점코드','가맹점번호','id','ID'])||''),
      name:String(pick(row,['가맹점명','점포명','상호명','상점명','상호','name'])||'온누리상품권 가맹점').trim(),
      market:String(pick(row,['소속 시장명(또는 상점가)','소속 시장명','시장명','전통시장명','market'])||'').trim(),
      address:String(pick(row,['소재지','주소','가맹점주소','도로명주소','지번주소','address','addr'])||'').trim(),
      category:String(pick(row,['취급품목','업종','품목','category'])||'').trim(),
      paper:yes(pick(row,['지류형 가맹 여부','지류형가맹여부','지류취급여부','지류','종이상품권','paper'])),
      digital:yes(pick(row,['디지털형 가맹 여부','디지털형가맹여부','디지털취급여부','충전식카드','모바일','digital','card'])),
      registeredYear:String(pick(row,['등록년도','등록연도','year'])||'').trim(),
      lng:num(pick(row,['경도','longitude','lng','x','X'])),
      lat:num(pick(row,['위도','latitude','lat','y','Y']))
    })).filter(x=>x.name||x.address);

    let local=normalized;
    if(regionWords.length){
      const narrowed=normalized.filter(x=>{
        const t=`${x.address} ${x.market}`;
        return regionWords.some(w=>w&&t.includes(w));
      });
      if(narrowed.length)local=narrowed;
    }

    local=local.slice(0,180);
    const geocoded=await mapLimit(local,8,async x=>{
      let glng=x.lng,glat=x.lat,coordinateSource='source';
      if(!validKorea(glat,glng)&&x.address&&kakaoKey){
        const g=await geocode(x.address,kakaoKey);
        if(g){glng=g.lng;glat=g.lat;coordinateSource='kakao-address'}
      }
      if(!validKorea(glat,glng))return null;
      if([west,south,east,north].every(Number.isFinite)){
        const pad=.025;
        if(glng<west-pad||glng>east+pad||glat<south-pad||glat>north+pad)return null;
      }
      return {id:x.id||`${x.name}:${x.address}`,name:x.name,address:x.address,market:x.market,category:x.category,paper:x.paper,digital:x.digital,registeredYear:x.registeredYear,lng:glng,lat:glat,coordinateSource,source:'semas-onnuri-2025'};
    });

    const items=geocoded.filter(Boolean);
    return json({ok:true,configured:true,provider:'소상공인시장진흥공단 전국 온누리상품권 가맹점 현황 2025-07-31',datasetUrl:OFFICIAL_ONNURI_2025_URL,region:{city:region?.city||'',district:region?.district||'',town:region?.town||''},fetchedRows:rows.length,localRows:local.length,mappedRows:items.length,fetchMeta,items},200);
  }catch(e){
    return json({ok:false,configured:true,code:'ONNURI_UPSTREAM_ERROR',error:'온누리상품권 가맹점 데이터를 불러오지 못했습니다.',detail:String(e?.message||e),items:[]},502);
  }
}

async function fetchOdcloudFiltered(source,key,keyword){
  const perPage=1000,rows=[];let page=1,totalCount=0,pages=0;
  for(;page<=20;page++){
    const u=buildOdcloudUrl(source,key,page,perPage);
    u.searchParams.set('cond[소재지::LIKE]',keyword);
    const d=await fetchOdcloudPage(u),data=arrayData(d);
    rows.push(...data);pages++;totalCount=Number(d.totalCount??d.matchCount??rows.length)||rows.length;
    if(data.length<perPage||rows.length>=totalCount)break;
  }
  return {rows,meta:{mode:'server-filter',query:`소재지 LIKE ${keyword}`,pages,totalCount}};
}
async function fetchOdcloudAllPages(source,key,{maxPages=120,perPage=1000,regionWords=[]}={}){
  const rows=[];let page=1,totalCount=Infinity,pages=0,seen=0;
  for(;page<=maxPages&&seen<totalCount;page++){
    const u=buildOdcloudUrl(source,key,page,perPage);
    const d=await fetchOdcloudPage(u),data=arrayData(d);
    pages++;seen+=data.length;totalCount=Number(d.totalCount??d.matchCount??totalCount);
    if(regionWords.length){
      for(const row of data){
        const addr=String(pick(row,['소재지','주소','가맹점주소','도로명주소','지번주소','address','addr'])||'');
        if(regionWords.some(w=>w&&addr.includes(w)))rows.push(row);
      }
    }else rows.push(...data);
    if(!data.length||data.length<perPage)break;
  }
  return {rows,meta:{mode:'full-pagination',pages,totalCount:Number.isFinite(totalCount)?totalCount:null,matched:rows.length,seen}};
}
function buildOdcloudUrl(source,key,page,perPage){
  const u=new URL(source);
  u.searchParams.set('page',String(page));u.searchParams.set('perPage',String(perPage));u.searchParams.set('returnType','JSON');
  if(!u.searchParams.has('serviceKey'))u.searchParams.set('serviceKey',key);
  return u;
}
async function fetchOdcloudPage(u){
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),10000);
  try{
    const r=await fetch(u,{headers:{accept:'application/json'},signal:ctrl.signal});
    const text=await r.text();
    if(!r.ok)throw new Error(`공공데이터 API HTTP ${r.status}: ${safeText(text)}`);
    const d=JSON.parse(text);
    if(String(d?.resultCode??'0')!=='0')throw new Error(`공공데이터 API ${d.resultCode}: ${d.resultMsg||'오류'}`);
    return d;
  }finally{clearTimeout(timer)}
}
function arrayData(d){
  const x=d?.data||d?.items||d?.response?.body?.items?.item||d?.response?.body?.items||[];
  return Array.isArray(x)?x:(x?[x]:[]);
}
async function resolveRegion(lat,lng,key){
  if(!key||!Number.isFinite(lat)||!Number.isFinite(lng))return null;
  try{
    const u=new URL('https://dapi.kakao.com/v2/local/geo/coord2regioncode.json');
    u.searchParams.set('x',lng);u.searchParams.set('y',lat);
    const r=await fetch(u,{headers:{Authorization:`KakaoAK ${key}`}});if(!r.ok)return null;
    const d=await r.json(),x=(d.documents||[]).find(v=>v.region_type==='H')||(d.documents||[])[0];
    return {city:String(x?.region_1depth_name||'').trim(),district:String(x?.region_2depth_name||'').trim(),town:String(x?.region_3depth_name||'').trim()};
  }catch{return null}
}
async function geocode(address,key){
  try{
    const u=new URL('https://dapi.kakao.com/v2/local/search/address.json');u.searchParams.set('query',address);
    const r=await fetch(u,{headers:{Authorization:`KakaoAK ${key}`}});if(!r.ok)return null;
    const d=await r.json(),x=(d.documents||[])[0];if(!x)return null;
    return{lng:num(x.x),lat:num(x.y)};
  }catch{return null}
}
async function mapLimit(items,limit,worker){
  const out=new Array(items.length);let cursor=0;
  async function run(){while(true){const i=cursor++;if(i>=items.length)return;try{out[i]=await worker(items[i],i)}catch{out[i]=null}}}
  await Promise.all(Array.from({length:Math.min(limit,items.length)},run));return out;
}
function normalizeServiceKey(v){const s=String(v||'').trim();if(!s)return '';try{return decodeURIComponent(s)}catch{return s}}
function pick(o,keys){for(const k of keys)if(o&&o[k]!=null&&String(o[k]).trim()!=='')return o[k];return ''}
function yes(v){return /^(y|yes|true|1|가능|취급|사용|o|○)$/i.test(String(v||'').trim())}
function num(v){const n=Number(v);return Number.isFinite(n)?n:NaN}
function validKorea(lat,lng){return Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=32&&lat<=39.8&&lng>=124&&lng<=132}
function safeText(s){return String(s||'').replace(/[?&]serviceKey=[^&\s]+/gi,'?serviceKey=***').slice(0,240)}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:JSON_HEADERS})}
