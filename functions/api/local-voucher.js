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
  const regionCode=String(region?.code||'');
  const hasBounds=[bounds.west,bounds.south,bounds.east,bounds.north].every(Number.isFinite);
  const perPage=2000,maxPages=25,maxVisible=800;
  const visible=[],seen=new Set();

  for(let page=1;page<=maxPages&&visible.length<maxVisible;page++){
    const u=new URL(FRANCHISE_URL);
    // 한국조폐공사 공개 예제(localpay.github.io)와 동일한 요청 규격
    u.searchParams.set('serviceKey',serviceKey);
    u.searchParams.set('page',String(page));
    u.searchParams.set('perPage',String(perPage));

    // 현재 지도 중심의 시군구 코드가 있으면 해당 지역 가맹점만 조회
    if(regionCode)u.searchParams.set('cond[usage_rgn_cd::EQ]',regionCode);

    const r=await fetch(u,{headers:{accept:'application/json'}});
    if(!r.ok)throw new Error(`KOMSCO franchise API ${r.status}`);

    const d=await parseResponse(r);
    const found=extractRows(d);
    if(!found.length)break;

    for(const row of found){
      const x=normalizeFranchise(row);
      if(!Number.isFinite(x.lat)||!Number.isFinite(x.lng))continue;
      if(hasBounds&&(x.lng<bounds.west||x.lng>bounds.east||x.lat<bounds.south||x.lat>bounds.north))continue;

      // 동일 좌표/가맹점 중복 제거
      const key=x.id||`${x.name}:${x.lat.toFixed(6)}:${x.lng.toFixed(6)}`;
      const prev=seen.get(key);
      if(prev){
        prev.card=Boolean(prev.card||x.card);
        prev.mobile=Boolean(prev.mobile||x.mobile);
        prev.paper=Boolean(prev.paper||x.paper);
        if(!prev.address&&x.address)prev.address=x.address;
      }else{
        seen.set(key,x);
        visible.push(x);
      }
      if(visible.length>=maxVisible)break;
    }

    const total=extractTotalCount(d);
    const current=Number(d?.currentCount ?? d?.data?.currentCount ?? found.length);
    if(found.length<perPage || current<perPage || (Number.isFinite(total)&&page*perPage>=total))break;
  }

  return visible.slice(0,maxVisible);
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
  const candidates=[
    d?.data,
    d?.items,d?.item,
    d?.response?.body?.items?.item,d?.response?.body?.items,d?.response?.body?.item,
    d?.body?.items?.item,d?.body?.items,d?.body?.item,
    d?.data?.items,d?.data?.item,
    d?.result?.items,d?.result?.item,d?.result
  ];
  for(const x of candidates){
    if(Array.isArray(x))return x;
    if(x&&typeof x==='object'&&!Array.isArray(x)){
      const vals=Object.values(x);
      const arr=vals.find(v=>Array.isArray(v)&&v.length&&typeof v[0]==='object');
      if(arr)return arr;
    }
  }

  // 공공데이터포털 응답 포맷 변경에도 대응: LAT/LOT 또는 가맹점명 계열 필드를 가진 객체 배열 탐색
  const queue=[d],seen=new Set();
  while(queue.length){
    const cur=queue.shift();
    if(!cur||typeof cur!=='object'||seen.has(cur))continue;
    seen.add(cur);
    for(const v of Object.values(cur)){
      if(Array.isArray(v)){
        if(v.length&&typeof v[0]==='object'){
          const sample=v[0]||{};
          const keys=Object.keys(sample).map(String);
          if(keys.some(k=>['LAT','latitude','lat','위도'].includes(k))||
             keys.some(k=>['FRCS_NM','franchiseName','frcsNm','가맹점명'].includes(k)))return v;
        }
        for(const y of v)if(y&&typeof y==='object')queue.push(y);
      }else if(v&&typeof v==='object')queue.push(v);
    }
  }
  return [];
}
function extractTotalCount(d){
  const vals=[
    d?.matchCount,d?.totalCount,d?.currentCount,
    d?.response?.body?.totalCount,d?.body?.totalCount,
    d?.data?.matchCount,d?.data?.totalCount
  ];
  for(const v of vals){const n=Number(v);if(Number.isFinite(n))return n}
  return NaN;
}
function pick(o,keys){for(const k of keys){const v=o?.[k];if(v!==undefined&&v!==null&&String(v).trim()!=='')return v}return ''}
function yn(v){const s=String(v??'').trim().toUpperCase();return ['Y','YES','1','TRUE','가능','사용'].includes(s)}
function normalizeFranchise(r){
  const stlmCode=String(pick(r,[
    'frcs_stlm_info_se','FRCS_STLM_INFO_SE','frcsStlmInfoSe',
    'FRCS_PAY_TYPE','frcsPayType','payType'
  ])||'').trim();
  const stlmName=String(pick(r,[
    'frcs_stlm_info_se_nm','FRCS_STLM_INFO_SE_NM','frcsStlmInfoSeNm',
    'FRCS_PAY_TYPE_NM','frcsPayTypeNm','payTypeName'
  ])||'').trim();
  const payText=`${stlmCode} ${stlmName}`.toLowerCase();

  // 공개 예제 기본값 03을 포함해 명칭/코드 모두 보존
  const card=/카드|card/.test(payText) || ['01','1'].includes(stlmCode);
  const mobile=/모바일|mobile|qr/.test(payText) || ['02','2','03','3'].includes(stlmCode);
  const paper=/지류|paper|voucher/.test(payText) || ['04','4'].includes(stlmCode)
    || yn(pick(r,['ppr_frcs_aply_yn','PPR_FRCS_APLY_YN','paperUseYn','paperYn','지류사용여부','지류가맹점여부']));

  const addr1=String(pick(r,[
    'frcs_addr','FRCS_ADDR','franchiseAddress','frcsAddr','roadAddress','address','rdnmAdr','가맹점주소','주소'
  ])||'').trim();
  const addr2=String(pick(r,[
    'frcs_dtl_addr','FRCS_DTL_ADDR','franchiseDetailAddress','frcsDtlAddr','가맹점상세주소'
  ])||'').trim();

  return {
    id:String(pick(r,[
      'brno','BRNO','frcs_zip','FRCS_ZIP','FRCS_ID','FRCS_NO',
      'franchiseId','franchiseNo','frcsId','가맹점번호','가맹점ID','id'
    ])||''),
    name:String(pick(r,[
      'frcs_nm','FRCS_NM','franchiseName','frcsNm','mrhstNm','storeName','가맹점명','상호명'
    ])||'지역사랑상품권 가맹점'),
    address:[addr1,addr2].filter(Boolean).join(' '),
    lat:Number(pick(r,['lat','LAT','latitude','LATITUDE','위도'])),
    lng:Number(pick(r,['lot','LOT','lon','LON','lng','LNG','longitude','LONGITUDE','경도'])),
    card,mobile,paper,
    category:String(pick(r,[
      'frcs_reg_se_nm','FRCS_REG_SE_NM','KSIC_NM','KSIC_NAME','ksicName','industryName','업종명'
    ])||''),
    payTypeName:stlmName,
    usageRegionCode:String(pick(r,['usage_rgn_cd','USAGE_RGN_CD','usageRegionCode'])||'')
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
