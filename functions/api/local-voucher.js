const FRANCHISE_URL='https://apis.data.go.kr/B190001/localFranchisesV2/franchiseV2';

export async function onRequestGet({request,env}){
  const url=new URL(request.url),lng=Number(url.searchParams.get('lng')),lat=Number(url.searchParams.get('lat'));
  if(!Number.isFinite(lng)||!Number.isFinite(lat))return json({error:'invalid coordinates'},400);
  const serviceKey=env.PUBLIC_DATA_SERVICE_KEY||env.DATA_GO_KR_SERVICE_KEY||'';
  if(!serviceKey)return json({error:'PUBLIC_DATA_SERVICE_KEY is not configured'},503);

  const region=await resolveRegion(lng,lat,env.KAKAO_REST_API_KEY);
  if(!region?.code)return json({error:'region code unavailable'},502);

  const bounds={
    west:Number(url.searchParams.get('west')),south:Number(url.searchParams.get('south')),
    east:Number(url.searchParams.get('east')),north:Number(url.searchParams.get('north'))
  };

  const franchise=await fetchFranchises(serviceKey,region,bounds);
  const policy=await fetchDiscountPolicy(serviceKey,region.code,env).catch(()=>null);
  return json({
    provider:'한국조폐공사_통합_가맹점기본정보',
    regionCode:region.code,regionName:region.name,
    discountRate:Number.isFinite(Number(policy?.discountRate))?Number(policy.discountRate):null,
    policyStart:policy?.startDate||'',policyEnd:policy?.endDate||'',
    monthlyPurchaseLimit:policy?.monthlyPurchaseLimit??null,
    items:franchise
  },200,120);
}

async function resolveRegion(lng,lat,kakaoKey){
  if(!kakaoKey)return null;
  const u=new URL('https://dapi.kakao.com/v2/local/geo/coord2regioncode.json');
  u.searchParams.set('x',String(lng));u.searchParams.set('y',String(lat));u.searchParams.set('input_coord','WGS84');
  const r=await fetch(u,{headers:{Authorization:`KakaoAK ${kakaoKey}`}});
  if(!r.ok)return null;
  const d=await r.json(),doc=(d.documents||[]).find(x=>x.region_type==='B')||d.documents?.[0];
  const legal=String(doc?.code||'').replace(/\D/g,'');
  return legal.length>=8?{
    code:legal.slice(0,5),
    emdCode:legal.slice(0,8),
    legalCode:legal,
    name:[doc.region_1depth_name,doc.region_2depth_name,doc.region_3depth_name].filter(Boolean).join(' ')
  }:legal.length>=5?{code:legal.slice(0,5),emdCode:'',legalCode:legal,name:[doc.region_1depth_name,doc.region_2depth_name].filter(Boolean).join(' ')}:null;
}

async function fetchFranchises(serviceKey,region,bounds){
  const regionCode=region?.code||'',emdCode=region?.emdCode||'';
  const regionParamNames=['usageRegionCode','useRegionCode','usageRegionCd','useRegionCd'];
  const emdParamNames=['eupMyeonDongCode','emdCode','eupmyeondongCode','읍면동코드'];
  const pageSize=1000,maxPages=20,maxVisible=500;
  const hasBounds=[bounds.west,bounds.south,bounds.east,bounds.north].every(Number.isFinite);

  async function collect(extraName,extraValue){
    const visible=[],seen=new Set();
    for(let page=1;page<=maxPages&&visible.length<maxVisible;page++){
      const u=new URL(FRANCHISE_URL);
      u.searchParams.set('serviceKey',serviceKey);
      u.searchParams.set('pageNo',String(page));
      u.searchParams.set('numOfRows',String(pageSize));
      u.searchParams.set('type','json');
      if(extraName&&extraValue)u.searchParams.set(extraName,extraValue);

      const r=await fetch(u);
      if(!r.ok)break;
      const d=await parseResponse(r),found=extractRows(d);
      if(!found.length)break;

      for(const row of found){
        const x=normalizeFranchise(row);
        if(!Number.isFinite(x.lat)||!Number.isFinite(x.lng))continue;
        if(hasBounds&&(x.lng<bounds.west||x.lng>bounds.east||x.lat<bounds.south||x.lat>bounds.north))continue;
        const key=x.id||`${x.name}:${x.lat.toFixed(6)}:${x.lng.toFixed(6)}`;
        if(seen.has(key))continue;seen.add(key);visible.push(x);
        if(visible.length>=maxVisible)break;
      }

      const total=extractTotalCount(d);
      if(found.length<pageSize||(Number.isFinite(total)&&page*pageSize>=total))break;
    }
    return visible;
  }

  // 현재 읍면동(8자리) 조회가 지원되면 가장 먼저 사용해 화면 주변 가맹점을 빠르게 찾는다.
  if(emdCode){
    for(const field of emdParamNames){
      const rows=await collect(field,emdCode);
      if(rows.length)return rows;
    }
  }

  // 읍면동 파라미터가 제공 API 버전에 없으면 시군구(5자리)를 페이지 순회한다.
  for(const field of regionParamNames){
    const rows=await collect(field,regionCode);
    if(rows.length)return rows;
  }

  return [];
}

async function fetchDiscountPolicy(serviceKey,regionCode,env){
  // 공공데이터포털의 '한국조폐공사_지역사랑상품권_지자체별_판매정책정보' API URL은
  // 배포환경에서 KOMSCO_SALES_POLICY_API_URL 로 지정하면 바로 연계된다.
  // (포털의 서비스 개편 시 URL만 교체 가능하도록 분리)
  const endpoint=env.KOMSCO_SALES_POLICY_API_URL||'';
  if(!endpoint)return null;
  const u=new URL(endpoint);
  u.searchParams.set('serviceKey',serviceKey);u.searchParams.set('pageNo','1');u.searchParams.set('numOfRows','100');
  u.searchParams.set('type','json');u.searchParams.set('usageRegionCode',regionCode);
  const r=await fetch(u);if(!r.ok)return null;
  const d=await parseResponse(r),rows=extractRows(d),now=new Date();
  const active=rows.map(normalizePolicy).filter(x=>{
    if(!x.discountRate&&x.discountRate!==0)return false;
    const start=parseDate(x.startDate),end=parseDate(x.endDate);
    return (!start||start<=now)&&(!end||now<=end);
  }).sort((a,b)=>Number(b.discountRate)-Number(a.discountRate));
  return active[0]||null;
}

async function parseResponse(r){
  const text=await r.text();
  try{return JSON.parse(text)}catch{return text}
}
function extractRows(d){
  if(Array.isArray(d))return d;
  const candidates=[d?.items,d?.response?.body?.items?.item,d?.response?.body?.items,d?.body?.items?.item,d?.body?.items,d?.data?.items,d?.data];
  for(const x of candidates){if(Array.isArray(x))return x;if(x&&typeof x==='object')return [x]}
  return [];
}
function extractTotalCount(d){
  const vals=[
    d?.matchCount,d?.totalCount,d?.response?.body?.totalCount,d?.body?.totalCount,d?.data?.matchCount,d?.data?.totalCount
  ];
  for(const v of vals){const n=Number(v);if(Number.isFinite(n))return n}
  return NaN;
}
function pick(o,keys){for(const k of keys){const v=o?.[k];if(v!==undefined&&v!==null&&String(v).trim()!=='')return v}return ''}
function yn(v){const s=String(v??'').trim().toUpperCase();return ['Y','YES','1','TRUE','가능','사용'].includes(s)}
function normalizeFranchise(r){
  return {
    id:String(pick(r,['franchiseId','franchiseNo','가맹점번호','가맹점ID','id'])||''),
    name:String(pick(r,['franchiseName','mrhstNm','storeName','가맹점명','상호명'])||'지역사랑상품권 가맹점'),
    address:String(pick(r,['roadAddress','address','rdnmAdr','소재지도로명주소','주소','지번주소'])||''),
    lat:Number(pick(r,['latitude','lat','위도'])),lng:Number(pick(r,['longitude','lng','lon','경도'])),
    card:yn(pick(r,['cardUseYn','cardYn','카드사용여부','카드가맹점여부'])),
    mobile:yn(pick(r,['mobileUseYn','mobileYn','모바일사용여부','모바일가맹점여부'])),
    paper:yn(pick(r,['paperUseYn','paperYn','voucherUseYn','지류사용여부','지류가맹점여부'])),
    category:String(pick(r,['ksicName','industryName','업종명','표준산업분류명'])||'')
  };
}
function normalizePolicy(r){
  return {
    discountRate:Number(pick(r,['discountRate','dscntRate','할인율'])),
    startDate:String(pick(r,['discountPolicyStartDate','policyStartDate','할인정책적용시작일자'])||''),
    endDate:String(pick(r,['discountPolicyEndDate','policyEndDate','할인정책적용종료일자'])||''),
    monthlyPurchaseLimit:Number(pick(r,['monthlyPurchaseLimit','monthPurchaseLimit','월간구매제한금액']))||null
  }
}
function parseDate(v){
  const s=String(v||'').replace(/\D/g,'');if(s.length<8)return null;
  const d=new Date(Number(s.slice(0,4)),Number(s.slice(4,6))-1,Number(s.slice(6,8)),23,59,59);
  return Number.isNaN(d.getTime())?null:d
}
function json(data,status=200,maxAge=0){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':maxAge?`public, max-age=${maxAge}`:'no-store'}})}
