const FRANCHISE_URL='https://apis.data.go.kr/B190001/localFranchisesV2/franchiseV2';
const SALES_POLICY_URL='https://apis.data.go.kr/B190001/salesPolicy';

function serviceKeyCandidates(raw){
  const src=String(raw||'').trim();
  const out=[];
  const add=v=>{v=String(v||'').trim();if(v&&!out.includes(v))out.push(v)};
  add(src);
  try{add(decodeURIComponent(src))}catch{}
  // 일부 환경에서 공백으로 변형된 + 복구 후보
  if(src.includes(' '))add(src.replace(/ /g,'+'));
  return out;
}

async function fetchKomsco(url,keyCandidates){
  let lastStatus=0,lastText='',lastError='';
  const transientStatus=new Set([408,425,429,500,502,503,504]);

  for(const key of keyCandidates){
    for(let attempt=0;attempt<2;attempt++){
      const u=new URL(url.toString());
      u.searchParams.set('serviceKey',key);
      const ctrl=new AbortController();
      const timer=setTimeout(()=>ctrl.abort(),10000);
      let r;
      try{
        r=await fetch(u,{headers:{accept:'application/json'},signal:ctrl.signal,cache:'no-store'});
        lastStatus=r.status;
        const text=await r.text();
        lastText=text;
        if(!r.ok){
          if(transientStatus.has(r.status)&&attempt===0){
            await new Promise(res=>setTimeout(res,350));
            continue;
          }
          break;
        }
        try{
          const data=JSON.parse(text);
          const code=String(data?.resultCode??data?.response?.header?.resultCode??'').trim();
          const msg=String(data?.resultMsg??data?.response?.header?.resultMsg??'').trim();
          const errorText=`${code} ${msg}`;
          if(code&&code!=='00'&&code!=='0'){
            lastError=errorText;
            if(/SERVICETIMEOUT|HTTP_ERROR|APPLICATION_ERROR|LIMITED_NUMBER/i.test(errorText)&&attempt===0){
              await new Promise(res=>setTimeout(res,350));
              continue;
            }
            break;
          }
          if(/SERVICE_KEY|인증키|등록되지 않은|INVALID_REQUEST|PERMISSION_DENIED|ACCESS_DENIED/i.test(msg)){
            lastError=msg;
            break;
          }
          return data;
        }catch{
          if(/SERVICE_KEY|인증키|등록되지 않은|INVALID_REQUEST|PERMISSION_DENIED|ACCESS_DENIED/i.test(text)){
            lastError=text.slice(0,300);
            break;
          }
          return text;
        }
      }catch(e){
        lastError=String(e?.name==='AbortError'?'timeout':e?.message||e);
        if(attempt===0){
          await new Promise(res=>setTimeout(res,350));
          continue;
        }
      }finally{
        clearTimeout(timer);
      }
    }
  }
  const e=new Error(`KOMSCO API failed (${lastStatus||'network'})`);
  e.status=lastStatus||502;
  e.detail=String(lastError||lastText||'').slice(0,300);
  throw e;
}

export async function onRequestGet({request,env}){
  const url=new URL(request.url),lng=Number(url.searchParams.get('lng')),lat=Number(url.searchParams.get('lat'));
  if(!Number.isFinite(lng)||!Number.isFinite(lat))return json({error:'invalid coordinates'},400);
  const requestedRegionCode=String(url.searchParams.get('regionCode')||'').replace(/\D/g,'').slice(0,5);
  const serviceKey=env.PUBLIC_DATA_SERVICE_KEY||env.DATA_GO_KR_SERVICE_KEY||'';
  if(!serviceKey)return json({error:'PUBLIC_DATA_SERVICE_KEY is not configured'},503);
  const keyCandidates=serviceKeyCandidates(serviceKey);

  // 지도 bounds 조회는 Kakao 지역코드 없이도 가능하게 하고,
  // 지역명/할인정책용으로만 Kakao 역지오코딩을 보조 사용한다.
  const resolvedRegion=await resolveRegion(lng,lat,env.KAKAO_REST_API_KEY).catch(()=>null);
  const region=resolvedRegion?.code?resolvedRegion:(requestedRegionCode?{code:requestedRegionCode,name:'현재 지역'}:null);

  const bounds={
    west:Number(url.searchParams.get('west')),south:Number(url.searchParams.get('south')),
    east:Number(url.searchParams.get('east')),north:Number(url.searchParams.get('north'))
  };

  let franchise=[],providerMode='bounds';
  try{
    franchise=await fetchFranchises(keyCandidates,region,bounds);
  }catch(e){
    return json({error:'KOMSCO franchise API failed',status:e?.status||502,detail:e?.detail||''},502);
  }
  const policies=region?.code?await fetchDiscountPolicies(keyCandidates,region.code,env).catch(()=>[]):[];
  const policy=pickActiveDiscountPolicy(policies);
  return json({
    provider:'한국조폐공사_통합_가맹점기본정보',
    discountProvider:'한국조폐공사_지역사랑상품권_지자체별_판매정책정보(15125217)',
    providerMode,
    regionCode:region?.code||'',regionName:region?.name||'현재 지도 영역',
    discountRate:Number.isFinite(Number(policy?.discountRate))?Number(policy.discountRate):null,
    discountLabel:policy?.discountLabel||'',
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

async function fetchFranchises(keyCandidates,region,bounds){
  const regionCode=String(region?.code||'');
  const hasBounds=[bounds.west,bounds.south,bounds.east,bounds.north].every(Number.isFinite);
  const perPage=2000,maxPages=25,maxVisible=1200;
  const visible=[],seen=new Map();

  for(let page=1;page<=maxPages&&visible.length<maxVisible;page++){
    const u=new URL(FRANCHISE_URL);
    u.searchParams.set('page',String(page));
    u.searchParams.set('perPage',String(perPage));

    // 지역사랑상품권 통합 가맹점 전체 조회: 카드/모바일/지류 유형 필터를 걸지 않는다.
    if(regionCode)u.searchParams.set('cond[usage_rgn_cd::EQ]',regionCode);

    const d=await fetchKomsco(u,keyCandidates);
    const found=extractRows(d);
    if(!found.length)break;

    for(const row of found){
      const x=normalizeFranchise(row);
      if(!Number.isFinite(x.lat)||!Number.isFinite(x.lng))continue;

      // regionCode가 없는 비상 조회일 때만 현재 지도 범위로 로컬 필터
      if(hasBounds&&(x.lng<bounds.west||x.lng>bounds.east||x.lat<bounds.south||x.lat>bounds.north))continue;

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
    const current=Number(d?.currentCount ?? found.length);
    if(found.length<perPage||current<perPage||(Number.isFinite(total)&&page*perPage>=total))break;
  }

  return visible.slice(0,maxVisible);
}

async function fetchDiscountPolicies(keyCandidates,regionCode,env){
  // data.go.kr 15125217 판매정책 API 활용.
  // 실제 호출 URL은 공공데이터포털 활용신청 후 발급되는 명세 URL을 배포변수에 등록한다.
  const endpoint=String(env.KOMSCO_SALES_POLICY_API_URL||SALES_POLICY_URL).trim();

  const attempts=[
    {page:'1',perPage:'200',regionParam:'cond[usage_rgn_cd::EQ]',style:'standard'},
    {page:'1',perPage:'200',regionParam:'usage_rgn_cd',style:'standard'},
    {pageNo:'1',numOfRows:'200',regionParam:'usageRegionCode',style:'legacy'}
  ];

  for(const a of attempts){
    for(const key of keyCandidates){
      try{
        const u=new URL(endpoint);
        u.searchParams.set('serviceKey',key);
        if(a.style==='standard'){
          u.searchParams.set('page',a.page);u.searchParams.set('perPage',a.perPage);
          u.searchParams.set(a.regionParam,regionCode);
        }else{
          u.searchParams.set('pageNo',a.pageNo);u.searchParams.set('numOfRows',a.numOfRows);
          u.searchParams.set('type','json');u.searchParams.set(a.regionParam,regionCode);
        }

        const ctrl=new AbortController();
        const timer=setTimeout(()=>ctrl.abort(),9000);
        let r;
        try{r=await fetch(u,{headers:{accept:'application/json'},signal:ctrl.signal})}
        finally{clearTimeout(timer)}
        if(!r.ok)continue;

        const d=await parseResponse(r);
        const rows=extractRows(d);
        if(!rows.length)continue;
        return rows.map(normalizePolicy).filter(x=>Number.isFinite(Number(x.discountRate)));
      }catch{}
    }
  }
  return [];
}
function pickActiveDiscountPolicy(rows){
  const now=new Date();
  const active=(rows||[]).filter(x=>{
    if(!Number.isFinite(Number(x.discountRate)))return false;
    const start=parseDate(x.startDate),end=parseDate(x.endDate);
    return (!start||start<=now)&&(!end||now<=end);
  });
  if(!active.length)return null;

  active.sort((a,b)=>Number(b.discountRate)-Number(a.discountRate));
  const top=active[0];
  const distinct=[...new Set(active.map(x=>Number(x.discountRate)).filter(Number.isFinite))].sort((a,b)=>b-a);
  top.discountLabel=distinct.length>1?`할인 ${distinct.join('·')}%`:`할인 ${top.discountRate}%`;
  return top;
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
    discountRate:Number(pick(r,[
      'dscnt_rt','DSCNT_RT','dscnt_rate','discount_rate','discountRate','dscntRate',
      'sale_rt','saleRate','할인율'
    ])),
    startDate:String(pick(r,[
      'dscnt_plcy_aply_bgng_ymd','DSCNT_PLCY_APLY_BGNG_YMD',
      'dscnt_plcy_bgng_ymd','policy_bgng_ymd',
      'discountPolicyStartDate','policyStartDate','할인정책적용시작일자'
    ])||''),
    endDate:String(pick(r,[
      'dscnt_plcy_aply_end_ymd','DSCNT_PLCY_APLY_END_YMD',
      'dscnt_plcy_end_ymd','policy_end_ymd',
      'discountPolicyEndDate','policyEndDate','할인정책적용종료일자'
    ])||''),
    monthlyPurchaseLimit:Number(pick(r,[
      'mt_prchs_lmt_amt','MT_PRCHS_LMT_AMT',
      'mon_prchs_lmt_amt','monthlyPurchaseLimit','monthPurchaseLimit','월간구매제한금액'
    ]))||null,
    providerCode:String(pick(r,['pvsn_inst_cd','PVSN_INST_CD','providerCode','제공기관코드'])||''),
    paymentType:String(pick(r,[
      'frcs_stlm_info_se','FRCS_STLM_INFO_SE','stlm_info_se','paymentType','상품권유형'
    ])||'')
  }
}
function parseDate(v){
  const s=String(v||'').replace(/\D/g,'');if(s.length<8)return null;
  const d=new Date(Number(s.slice(0,4)),Number(s.slice(4,6))-1,Number(s.slice(6,8)),23,59,59);
  return Number.isNaN(d.getTime())?null:d
}
function json(data,status=200,maxAge=0){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':maxAge?`public, max-age=${maxAge}`:'no-store'}})}
