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
  const policyOnly=url.searchParams.get('policyOnly')==='1';
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

  let franchise=[],providerMode=policyOnly?'policy-only':'bounds';
  if(!policyOnly){
    try{
      franchise=await fetchFranchises(keyCandidates,region,bounds,env.KAKAO_REST_API_KEY);
    }catch(e){
      return json({error:'KOMSCO franchise API failed',status:e?.status||502,detail:e?.detail||''},502);
    }
  }
  let policyResult={rows:[],status:'region-unavailable',detail:''};
  if(region?.code){
    try{policyResult=await fetchDiscountPolicies(keyCandidates,region.code,env)}
    catch(e){policyResult={rows:[],status:'error',detail:String(e?.message||e||'').slice(0,180)}}
  }
  const policy=pickActiveDiscountPolicy(policyResult.rows);
  return json({
    provider:'한국조폐공사_통합_가맹점기본정보',
    discountProvider:'한국조폐공사_지역사랑상품권_지자체별_판매정책정보(15125217)',
    providerMode,
    regionCode:region?.code||'',regionName:region?.name||'현재 지도 영역',
    discountRate:Number.isFinite(Number(policy?.discountRate))?Number(policy.discountRate):null,
    discountLabel:policy?.discountLabel||'',
    policyStart:policy?.startDate||'',policyEnd:policy?.endDate||'',
    monthlyPurchaseLimit:policy?.monthlyPurchaseLimit??null,
    discountStatus:policy? 'ok' : (policyResult.status||'no-policy'),
    discountDetail:policy?'':String(policyResult.detail||'').slice(0,180),
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

async function fetchFranchises(keyCandidates,region,bounds,kakaoKey){
  const regionCode=String(region?.code||'');
  const hasBounds=[bounds.west,bounds.south,bounds.east,bounds.north].every(Number.isFinite);
  const perPage=2000,maxPages=25,maxVisible=1200;
  const visible=[],seen=new Map(),needGeocode=[];

  for(let page=1;page<=maxPages&&visible.length<maxVisible;page++){
    const u=new URL(FRANCHISE_URL);
    u.searchParams.set('page',String(page));
    u.searchParams.set('perPage',String(perPage));
    if(regionCode)u.searchParams.set('cond[usage_rgn_cd::EQ]',regionCode);

    const d=await fetchKomsco(u,keyCandidates);
    const found=extractRows(d);
    if(!found.length)break;

    for(const row of found){
      const x=normalizeFranchise(row);

      // 공공데이터의 빈 좌표가 Number('') -> 0 으로 변환되어
      // 한반도 서쪽 바다에 세로줄처럼 찍히는 문제를 차단한다.
      if(!validKoreaCoordinate(x.lat,x.lng)){
        if(x.address&&kakaoKey&&needGeocode.length<260)needGeocode.push(x);
        continue;
      }

      // 좌표가 있는 행은 현재 지도 범위와 너무 동떨어진 잘못된 좌표를 배제.
      if(hasBounds&&!pointNearBounds(x.lng,x.lat,bounds,0.02))continue;

      addFranchise(visible,seen,x);
      if(visible.length>=maxVisible)break;
    }

    const total=extractTotalCount(d);
    const current=Number(d?.currentCount ?? found.length);
    if(found.length<perPage||current<perPage||(Number.isFinite(total)&&page*perPage>=total))break;
  }

  // 좌표 누락/비정상 가맹점은 주소를 Kakao 주소검색으로 복원.
  // 과도한 외부 호출 방지를 위해 최대 260건, 동시 6건으로 제한.
  if(kakaoKey&&needGeocode.length&&visible.length<maxVisible){
    for(let i=0;i<needGeocode.length&&visible.length<maxVisible;i+=6){
      const batch=needGeocode.slice(i,i+6);
      const fixed=await Promise.all(batch.map(x=>geocodeFranchiseAddress(x,kakaoKey).catch(()=>null)));
      for(const x of fixed){
        if(!x||!validKoreaCoordinate(x.lat,x.lng))continue;
        if(hasBounds&&!pointNearBounds(x.lng,x.lat,bounds,0.02))continue;
        addFranchise(visible,seen,x);
        if(visible.length>=maxVisible)break;
      }
    }
  }

  return visible.slice(0,maxVisible);
}

function addFranchise(visible,seen,x){
  const key=x.id||`${x.name}:${x.lat.toFixed(6)}:${x.lng.toFixed(6)}`;
  const prev=seen.get(key);
  if(prev){
    prev.card=Boolean(prev.card||x.card);
    prev.mobile=Boolean(prev.mobile||x.mobile);
    prev.paper=Boolean(prev.paper||x.paper);
    if(!prev.address&&x.address)prev.address=x.address;
  }else{
    seen.set(key,x);visible.push(x);
  }
}

function parseCoordinate(v){
  if(v===undefined||v===null)return NaN;
  const text=String(v).trim();
  if(!text)return NaN;
  const n=Number(text.replace(/,/g,''));
  return Number.isFinite(n)?n:NaN;
}

function normalizeKoreaCoordinate(lat,lng){
  let a=parseCoordinate(lat),b=parseCoordinate(lng);
  // 위도/경도가 뒤바뀐 데이터 보정
  if(a>120&&a<135&&b>30&&b<45)[a,b]=[b,a];
  return {lat:a,lng:b};
}
function validKoreaCoordinate(lat,lng){
  return Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=33.0&&lat<=38.75&&lng>=125.65&&lng<=131.05;
}
function pointNearBounds(lng,lat,b,margin=0.35){
  return lng>=Number(b.west)-margin&&lng<=Number(b.east)+margin&&lat>=Number(b.south)-margin&&lat<=Number(b.north)+margin;
}
async function geocodeFranchiseAddress(item,kakaoKey){
  const q=String(item.address||'').trim();if(!q)return null;
  const u=new URL('https://dapi.kakao.com/v2/local/search/address.json');
  u.searchParams.set('query',q);
  u.searchParams.set('size','1');
  const r=await fetch(u,{headers:{Authorization:`KakaoAK ${kakaoKey}`}});
  if(!r.ok)return null;
  const d=await r.json(),doc=d.documents?.[0];
  let lng=parseCoordinate(doc?.x),lat=parseCoordinate(doc?.y);
  if(!validKoreaCoordinate(lat,lng))return null;
  return {...item,lng,lat,coordinateSource:'kakao-address'};
}

async function fetchDiscountPolicies(keyCandidates,regionCode,env){
  const endpoint=String(env.KOMSCO_SALES_POLICY_API_URL||SALES_POLICY_URL).trim();
  const attempts=[
    // 가장 호환성이 높은 최소요청부터 시도한다. 지역필터는 응답을 받은 뒤 로컬에서 적용한다.
    {kind:'standard-all',params:{page:'1',perPage:'1000',returnType:'JSON'}},
    {kind:'standard-all-type',params:{page:'1',perPage:'1000',type:'json'}},
    {kind:'legacy-all',params:{pageNo:'1',numOfRows:'1000',type:'json'}},
    // 서버측 지역조건을 지원하는 경우의 보조 시도
    {kind:'standard-cond',params:{page:'1',perPage:'1000','cond[usage_rgn_cd::EQ]':regionCode,returnType:'JSON'}},
    {kind:'standard-direct',params:{page:'1',perPage:'1000',usage_rgn_cd:regionCode,returnType:'JSON'}},
    {kind:'legacy-region',params:{pageNo:'1',numOfRows:'1000',type:'json',usageRegionCode:regionCode}}
  ];

  let lastDetail='',lastStatus='';
  for(const a of attempts){
    for(const key of keyCandidates){
      try{
        const u=new URL(endpoint);
        // URLSearchParams에 디코딩 키를 넣으면 URL 인코딩은 한 번만 적용된다.
        u.searchParams.set('serviceKey',key);
        for(const [k,v] of Object.entries(a.params))u.searchParams.set(k,String(v));

        const ctrl=new AbortController();
        const timer=setTimeout(()=>ctrl.abort(),10000);
        let rr,text;
        try{
          rr=await fetch(u,{headers:{accept:'application/json, application/xml;q=0.8, text/xml;q=0.7'},signal:ctrl.signal,cache:'no-store'});
          text=await rr.text();
        }finally{clearTimeout(timer)}

        lastStatus=String(rr?.status||'');
        if(!rr?.ok){lastDetail=`HTTP ${lastStatus}`;continue}

        const parsed=parsePolicyPayload(text);
        if(parsed.error){
          lastDetail=parsed.error;
          // 인증키 오류라면 다음 key candidate로 넘어가고, 잘못된 파라미터면 다음 요청형식을 시도한다.
          continue;
        }

        const rawRows=extractPolicyRows(parsed.data);
        if(!rawRows.length){lastDetail=`${a.kind}: rows 0`;continue}

        const normalized=rawRows.map(normalizePolicy)
          .filter(x=>Number.isFinite(Number(x.discountRate)));

        if(!normalized.length){lastDetail=`${a.kind}: discount field not recognized`;continue}

        const exact=normalized.filter(x=>String(x.usageRegionCode||'').replace(/\D/g,'').slice(0,5)===regionCode);
        // 응답에 지역코드 필드가 있으면 현재 지역만 사용.
        // 지역코드 필드가 전혀 없을 때만 서버측 지역필터 응답을 신뢰한다.
        const anyRegionField=normalized.some(x=>String(x.usageRegionCode||'').trim());
        const rows=exact.length?exact:(!anyRegionField&&/cond|direct|region/.test(a.kind)?normalized:[]);
        if(rows.length)return {rows,status:'ok',detail:`${a.kind}:${rows.length}`};

        lastDetail=`${a.kind}: region ${regionCode} not found`;
      }catch(e){
        lastDetail=e?.name==='AbortError'?'policy timeout':String(e?.message||e||'policy error').slice(0,160);
      }
    }
  }
  return {rows:[],status:lastStatus?`http-${lastStatus}`:'no-policy',detail:lastDetail};
}

function parsePolicyPayload(text){
  const src=String(text||'').trim();
  if(!src)return {data:null,error:'empty response'};
  try{
    const d=JSON.parse(src);
    const code=String(d?.resultCode??d?.response?.header?.resultCode??d?.header?.resultCode??'').trim();
    const msg=String(d?.resultMsg??d?.response?.header?.resultMsg??d?.header?.resultMsg??'').trim();
    if(code&&code!=='00'&&code!=='0')return {data:d,error:`${code} ${msg}`.trim()};
    const raw=JSON.stringify(d).slice(0,500);
    if(/SERVICE_KEY|PERMISSION_DENIED|SERVICE_ACCESS_DENIED|등록되지 않은|인증키/i.test(`${msg} ${raw}`))
      return {data:d,error:msg||'API 인증 오류'};
    return {data:d,error:''};
  }catch{}

  // JSON 강제 옵션을 무시하고 XML로 응답하는 경우도 처리
  if(/^</.test(src)){
    const errCode=xmlTag(src,'resultCode')||xmlTag(src,'returnReasonCode');
    const errMsg=xmlTag(src,'resultMsg')||xmlTag(src,'returnAuthMsg');
    if(errCode&&errCode!=='00'&&errCode!=='0')return {data:null,error:`${errCode} ${errMsg}`.trim()};
    const items=[...src.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(m=>xmlObject(m[1]));
    if(items.length)return {data:{items},error:''};
    const rows=[...src.matchAll(/<(?:data|row)\b[^>]*>([\s\S]*?)<\/(?:data|row)>/gi)].map(m=>xmlObject(m[1])).filter(x=>Object.keys(x).length);
    if(rows.length)return {data:{items:rows},error:''};
    return {data:null,error:errMsg||'XML rows 0'};
  }
  return {data:null,error:'unknown response format'};
}
function xmlTag(src,name){
  const m=String(src||'').match(new RegExp(`<${name}[^>]*>([\\\\s\\\\S]*?)<\\\\/${name}>`,'i'));
  return m?decodeXml(m[1]).trim():'';
}
function xmlObject(fragment){
  const out={};
  const re=/<([A-Za-z0-9_가-힣]+)[^>]*>([\s\S]*?)<\/\1>/g;
  let m;while((m=re.exec(fragment)))out[m[1]]=decodeXml(String(m[2]).replace(/<[^>]+>/g,'')).trim();
  return out;
}
function decodeXml(v){return String(v||'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'")}

function extractPolicyRows(d){
  if(Array.isArray(d))return d;
  const direct=[
    d?.data,d?.items,d?.item,
    d?.response?.body?.items?.item,d?.response?.body?.items,d?.response?.body?.item,
    d?.body?.items?.item,d?.body?.items,d?.body?.item,
    d?.data?.items,d?.data?.item,d?.result?.items,d?.result?.item,d?.result
  ];
  for(const x of direct){
    if(Array.isArray(x))return x;
    if(x&&typeof x==='object'){
      const arrays=Object.values(x).filter(v=>Array.isArray(v)&&v.length&&typeof v[0]==='object');
      if(arrays.length)return arrays[0];
    }
  }
  const queue=[d],seen=new Set();
  while(queue.length){
    const cur=queue.shift();
    if(!cur||typeof cur!=='object'||seen.has(cur))continue;
    seen.add(cur);
    for(const v of Object.values(cur)){
      if(Array.isArray(v)&&v.length&&typeof v[0]==='object'){
        const keys=Object.keys(v[0]||{}).map(k=>String(k).toLowerCase());
        if(keys.some(k=>/dscnt|discount|할인/.test(k))||
           keys.some(k=>/usage.*rgn|usage.*region|사용처지역/.test(k)))return v;
      }
      if(v&&typeof v==='object'){
        if(Array.isArray(v))for(const y of v)if(y&&typeof y==='object')queue.push(y);
        else queue.push(v);
      }
    }
  }
  return [];
}
function pickActiveDiscountPolicy(rows){
  const now=new Date(),all=(rows||[]).filter(x=>Number.isFinite(Number(x.discountRate)));
  if(!all.length)return null;
  const active=all.filter(x=>{
    const start=parseDate(x.startDate),end=parseDate(x.endDate);
    return (!start||start<=now)&&(!end||now<=end);
  });
  const candidates=active.length?active:all.filter(x=>{
    const start=parseDate(x.startDate);return !start||start<=now;
  });
  if(!candidates.length)return null;
  candidates.sort((a,b)=>{
    const ae=parseDate(a.endDate)?.getTime()||parseDate(a.startDate)?.getTime()||0;
    const be=parseDate(b.endDate)?.getTime()||parseDate(b.startDate)?.getTime()||0;
    return active.length?(Number(b.discountRate)-Number(a.discountRate)):(be-ae);
  });
  const top=candidates[0];
  const samePeriod=active.length?active:candidates.filter(x=>String(x.endDate||'')===String(top.endDate||''));
  const distinct=[...new Set(samePeriod.map(x=>Number(x.discountRate)).filter(Number.isFinite))].sort((a,b)=>b-a);
  top.discountLabel=active.length
    ? (distinct.length>1?`할인 ${distinct.join('·')}%`:`할인 ${top.discountRate}%`)
    : `최근 할인 ${top.discountRate}%`;
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
    ...normalizeKoreaCoordinate(
      pick(r,['lat','LAT','latitude','LATITUDE','위도']),
      pick(r,['lot','LOT','lon','LON','lng','LNG','longitude','LONGITUDE','경도'])
    ),
    card,mobile,paper,
    category:String(pick(r,[
      'frcs_reg_se_nm','FRCS_REG_SE_NM','KSIC_NM','KSIC_NAME','ksicName','industryName','업종명'
    ])||''),
    payTypeName:stlmName,
    usageRegionCode:String(pick(r,['usage_rgn_cd','USAGE_RGN_CD','usageRegionCode'])||'')
  };
}
function numericValue(v){
  if(v===undefined||v===null)return NaN;
  const s=String(v).replace(/,/g,'').replace(/%/g,'').replace(/원/g,'').trim();
  const n=Number(s);return Number.isFinite(n)?n:NaN;
}
function normalizePolicy(r){
  const lower={};
  for(const [k,v] of Object.entries(r||{}))lower[String(k).toLowerCase()]=v;
  const fuzzy=(patterns)=>{
    for(const [k,v] of Object.entries(r||{})){
      const nk=String(k).toLowerCase().replace(/[_\s-]/g,'');
      if(patterns.some(re=>re.test(nk)))return v;
    }
    return '';
  };
  const discountRaw=pick(r,[
    'dscnt_rt','DSCNT_RT','dscnt_rate','discount_rate','discountRate','dscntRate',
    'sale_rt','saleRate','disc_rate','discRate','할인율'
  ]) || fuzzy([/dscnt.*rt/,/discount.*rate/,/할인율/]);
  const regionRaw=pick(r,[
    'usage_rgn_cd','USAGE_RGN_CD','usageRegionCode','usage_region_code',
    'useAreaCode','useRegionCode','사용처지역코드','사용지역코드'
  ]) || fuzzy([/usagergncd/,/usageregioncode/,/사용처지역코드/,/사용지역코드/]);

  return {
    usageRegionCode:String(regionRaw||'').replace(/\D/g,'').slice(0,5),
    discountRate:numericValue(discountRaw),
    startDate:String(pick(r,[
      'dscnt_plcy_aply_bgng_ymd','DSCNT_PLCY_APLY_BGNG_YMD',
      'dscnt_plcy_aply_strt_ymd','DSCNT_PLCY_APLY_STRT_YMD',
      'dscnt_plcy_bgng_ymd','policy_bgng_ymd',
      'discountPolicyStartDate','policyStartDate','discountStartDate',
      '할인정책적용시작일자','할인정책적용시작일'
    ])||fuzzy([/dscnt.*(?:bgng|strt|start)/,/할인정책.*시작/])||''),
    endDate:String(pick(r,[
      'dscnt_plcy_aply_end_ymd','DSCNT_PLCY_APLY_END_YMD',
      'dscnt_plcy_end_ymd','policy_end_ymd',
      'discountPolicyEndDate','policyEndDate','discountEndDate',
      '할인정책적용종료일자','할인정책적용종료일'
    ])||fuzzy([/dscnt.*end/,/할인정책.*종료/])||''),
    monthlyPurchaseLimit:(()=>{
      const v=pick(r,[
        'mt_prchs_lmt_amt','MT_PRCHS_LMT_AMT','mon_prchs_lmt_amt',
        'monthlyPurchaseLimit','monthPurchaseLimit','monthly_limit_amt','월간구매제한금액'
      ])||fuzzy([/prchs.*lmt.*amt/,/monthly.*limit/,/월간구매제한/]);
      const n=numericValue(v);return Number.isFinite(n)?n:null;
    })(),
    providerCode:String(pick(r,['pvsn_inst_cd','PVSN_INST_CD','providerCode','제공기관코드'])||''),
    paymentType:String(pick(r,[
      'frcs_stlm_info_se','FRCS_STLM_INFO_SE','stlm_info_se','paymentType',
      'giftCardType','상품권유형','결제수단구분'
    ])||'')
  }
}
function parseDate(v){
  const s=String(v||'').replace(/\D/g,'');if(s.length<8)return null;
  const d=new Date(Number(s.slice(0,4)),Number(s.slice(4,6))-1,Number(s.slice(6,8)),23,59,59);
  return Number.isNaN(d.getTime())?null:d
}
function json(data,status=200,maxAge=0){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':maxAge?`public, max-age=${maxAge}`:'no-store'}})}
