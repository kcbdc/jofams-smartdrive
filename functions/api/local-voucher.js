const FRANCHISE_URL='https://apis.data.go.kr/B190001/localFranchisesV2/franchiseV2';
const SALES_POLICY_URL='https://apis.data.go.kr/B190001/salesPolicy';
import {KOMSCO_REGION_CODES} from './komsco-region-codes.js';

// 한국조폐공사 판매정책(할인율) 데이터는 자치구 단위가 아니라 "사용코드" 단위로 등록되어 있다.
// 예) 서울 강북구(법정동코드 11305)의 할인정책은 자치구 코드가 아니라 서울 전체 코드(11000)로 등록됨.
// 또한 강원/전북처럼 최근 지역코드가 개편된 곳은 여전히 개편 이전 코드(과거 사용처지역코드)로
// 등록되어 있을 수 있다. resolveKomscoQueryCodes()는 Kakao가 반환한 법정동코드(자치구 단위)를
// 실제 판매정책 API가 쓰는 코드 후보들로 변환한다(우선순위: 사용코드 → 과거코드 → 원본 법정동코드).
function resolveKomscoQueryCodes(districtCode){
  const out=[];
  const add=c=>{c=String(c||'').replace(/\D/g,'').slice(0,5);if(c&&!out.includes(c))out.push(c)};
  const entry=KOMSCO_REGION_CODES[String(districtCode||'')];
  if(entry){add(entry[0]);add(entry[1])}
  add(districtCode);
  return out;
}

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
    const komscoCodes=resolveKomscoQueryCodes(region.code);
    try{policyResult=await fetchDiscountPolicies(keyCandidates,komscoCodes,env)}
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
  const perPage=2000,maxPages=25,maxVisible=420;
  const rawCandidates=[],seenRaw=new Set();

  for(let page=1;page<=maxPages&&rawCandidates.length<maxVisible*3;page++){
    const u=new URL(FRANCHISE_URL);
    u.searchParams.set('page',String(page));
    u.searchParams.set('perPage',String(perPage));
    if(regionCode)u.searchParams.set('cond[usage_rgn_cd::EQ]',regionCode);

    const d=await fetchKomsco(u,keyCandidates);
    const found=extractRows(d);
    if(!found.length)break;

    for(const row of found){
      const x=normalizeFranchise(row);
      const rawKey=x.id||`${x.name}:${x.address}`;
      if(seenRaw.has(rawKey))continue;
      seenRaw.add(rawKey);
      rawCandidates.push(x);
      if(rawCandidates.length>=maxVisible*3)break;
    }

    const total=extractTotalCount(d);
    const current=Number(d?.currentCount ?? found.length);
    if(found.length<perPage||current<perPage||(Number.isFinite(total)&&page*perPage>=total))break;
  }

  // 통합 가맹점 API에서 특정 위도/경도가 대량 반복되면 지도에 세로/가로 일직선이 생긴다.
  // 5자리 소수점 기준 반복비율을 계산해 이런 원본좌표는 "의심좌표"로 분류한다.
  const latBins=new Map(),lngBins=new Map();
  for(const x of rawCandidates){
    if(validKoreaCoordinate(x.lat,x.lng)){
      const lk=Number(x.lat).toFixed(5),ok=Number(x.lng).toFixed(5);
      latBins.set(lk,(latBins.get(lk)||0)+1);
      lngBins.set(ok,(lngBins.get(ok)||0)+1);
    }
  }
  const suspiciousLat=new Set([...latBins].filter(([,n])=>n>=5&&n/Math.max(1,rawCandidates.length)>=.18).map(([k])=>k));
  const suspiciousLng=new Set([...lngBins].filter(([,n])=>n>=5&&n/Math.max(1,rawCandidates.length)>=.18).map(([k])=>k));

  // 좌표가 완전히 동일하지 않아도, 경도(또는 위도)가 좁은 폭 안에 몰려있으면서
  // 반대축(위도 또는 경도)이 넓게 퍼져 있으면 지도에서는 여전히 하나의 직선으로 보인다.
  // (예: 첨부 스크린샷처럼 경도는 거의 고정, 위도만 남북으로 길게 늘어선 패턴)
  // 이런 "준-직선" 패턴을 잡기 위해 약 2km 폭 밴드 단위로 좌표를 묶어 넓은 위도/경도 스팬을 탐지한다.
  const lineBadKeys=detectLinearArtifactBands(rawCandidates);

  const suspicious=x=>validKoreaCoordinate(x.lat,x.lng)&&(
    suspiciousLat.has(Number(x.lat).toFixed(5))||
    suspiciousLng.has(Number(x.lng).toFixed(5))||
    lineBadKeys.has(x)
  );

  const visible=[],seen=new Map();

  for(let i=0;i<rawCandidates.length&&visible.length<maxVisible;i+=6){
    const batch=rawCandidates.slice(i,i+6);
    const resolved=await Promise.all(batch.map(async x=>{
      // 주소가 있으면 API 원본 좌표보다 주소 기반 좌표를 우선한다.
      if(kakaoKey&&x.address){
        const fixed=await geocodeFranchiseAddress(x,kakaoKey).catch(()=>null);
        if(fixed)return fixed;
      }

      // 주소검색이 실패하면 상호명+주소 키워드검색으로 한 번 더 보정한다.
      if(kakaoKey){
        const fixed=await geocodeFranchiseKeyword(x,kakaoKey).catch(()=>null);
        if(fixed)return fixed;
      }

      // 반복 직선패턴으로 판정된 원본좌표는 잘못된 위치로 보이므로 표시하지 않는다.
      if(suspicious(x))return null;
      return validKoreaCoordinate(x.lat,x.lng)?{...x,coordinateSource:'komsco-raw'}:null;
    }));

    for(const x of resolved){
      if(!x||!validKoreaCoordinate(x.lat,x.lng))continue;
      if(hasBounds&&!pointNearBounds(x.lng,x.lat,bounds,0.03))continue;
      addFranchise(visible,seen,x);
      if(visible.length>=maxVisible)break;
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
/* 완전 동일 좌표 반복이 아니어도, 좁은 경도/위도 밴드 안에 다수 지점이 몰려있으면서
   반대축으로는 광범위(약 30km 이상)하게 퍼져 있으면 지도에서 하나의 직선처럼 보인다.
   BIN 폭(약 0.02도 ≈ 2km) 단위로 좌표를 묶어 이런 준-직선 패턴을 찾아낸다. */
// 7.6.1.9: "전체 후보 수 대비 5% 이상"이라는 비율 조건이 절대 개수 조건(MIN_COUNT)과 함께 AND로
// 걸려 있어서, 넓은 bbox 요청으로 전체 후보 수가 많아지면(수백~수천 건) 실제로는 뚜렷한 일직선
// (12~20곳 수준)이어도 비율 조건을 충족하지 못해 걸러지지 않는 문제가 있었다. 일직선 패턴은
// 전체 데이터 규모와 무관한 기하학적 특성이므로 비율 조건을 제거하고 절대 개수만으로 판단한다.
// 또한 고정 격자 하나만 쓰면 밴드 경계에 걸친 점들이 서로 다른 bin으로 갈라져 탐지를 놓칠 수 있어
// 원래 격자와 반 칸(BIN/2) 밀린 격자를 모두 스캔해 합친다.
function detectLinearArtifactBands(rows){
  const bad=new Set();
  const valid=rows.filter(x=>validKoreaCoordinate(x.lat,x.lng));
  const BIN=0.02,MIN_COUNT=6,MIN_SPAN=.3;
  if(valid.length<MIN_COUNT)return bad;
  const scan=(getKey,getSpanValue)=>{
    for(const offset of [0,BIN/2]){
      const bins=new Map();
      for(const x of valid){
        const k=Math.round((getKey(x)+offset)/BIN);
        if(!bins.has(k))bins.set(k,[]);
        bins.get(k).push(x);
      }
      for(const list of bins.values()){
        if(list.length<MIN_COUNT)continue;
        const values=list.map(getSpanValue);
        if(Math.max(...values)-Math.min(...values)>=MIN_SPAN)
          for(const x of list)bad.add(x);
      }
    }
  };
  scan(x=>Number(x.lng),x=>Number(x.lat)); // 경도가 좁게 몰리고 위도가 길게 늘어진 세로 직선
  scan(x=>Number(x.lat),x=>Number(x.lng)); // 위도가 좁게 몰리고 경도가 길게 늘어진 가로 직선
  return bad;
}
function pointNearBounds(lng,lat,b,margin=0.35){
  return lng>=Number(b.west)-margin&&lng<=Number(b.east)+margin&&lat>=Number(b.south)-margin&&lat<=Number(b.north)+margin;
}
async function geocodeFranchiseAddress(item,kakaoKey){
  const raw=String(item.address||'').trim();if(!raw)return null;
  // 상세주소(층/호/괄호)가 주소검색을 실패시키는 경우가 있어 단계적으로 단순화한다.
  const candidates=[];
  const push=q=>{q=String(q||'').replace(/\s+/g,' ').trim();if(q&&!candidates.includes(q))candidates.push(q)};
  push(raw);
  push(raw.replace(/\([^)]*\)/g,'').replace(/\s+(?:지하?\s*)?\d+층.*$/,'').replace(/\s+\d+호.*$/,''));
  const tokens=raw.replace(/\([^)]*\)/g,'').split(/\s+/);
  if(tokens.length>3)push(tokens.slice(0,Math.min(tokens.length,6)).join(' '));

  for(const q of candidates){
    const u=new URL('https://dapi.kakao.com/v2/local/search/address.json');
    u.searchParams.set('query',q);
    u.searchParams.set('size','1');
    const r=await fetch(u,{headers:{Authorization:`KakaoAK ${kakaoKey}`}});
    if(!r.ok)continue;
    const d=await r.json(),doc=d.documents?.[0];
    const lng=parseCoordinate(doc?.x),lat=parseCoordinate(doc?.y);
    if(validKoreaCoordinate(lat,lng))return {...item,lng,lat,coordinateSource:'kakao-address'};
  }
  return null;
}

async function geocodeFranchiseKeyword(item,kakaoKey){
  const name=String(item.name||'').trim(),address=String(item.address||'').trim();
  const queries=[];
  const push=q=>{q=String(q||'').replace(/\s+/g,' ').trim();if(q&&!queries.includes(q))queries.push(q)};
  push(`${name} ${address}`);
  push(name);
  for(const q of queries){
    const u=new URL('https://dapi.kakao.com/v2/local/search/keyword.json');
    u.searchParams.set('query',q);
    u.searchParams.set('size','3');
    const r=await fetch(u,{headers:{Authorization:`KakaoAK ${kakaoKey}`}});
    if(!r.ok)continue;
    const d=await r.json();
    const docs=Array.isArray(d?.documents)?d.documents:[];
    for(const doc of docs){
      const lng=parseCoordinate(doc?.x),lat=parseCoordinate(doc?.y);
      if(!validKoreaCoordinate(lat,lng))continue;
      // 주소가 있으면 결과 주소가 같은 시/구 수준인지 최소 검증한다.
      if(address){
        const src=address.replace(/\s+/g,' ');
        const dst=String(doc.road_address_name||doc.address_name||'').replace(/\s+/g,' ');
        const head=src.split(' ').slice(0,2).join(' ');
        if(head&&dst&&!dst.includes(head.split(' ')[0]))continue;
      }
      return {...item,lng,lat,coordinateSource:'kakao-keyword'};
    }
  }
  return null;
}

// 7.6.2.3: 판매정책 API는 전국 약 250개 시군구 x 개정 이력이 누적되어 총 로우 수가
// perPage(최대 1000) 한 페이지를 넘는 경우가 많다. 기존 코드는 매 요청형식마다 1페이지만
// 조회했기 때문에, 조회 대상 지역(예: 태안군 44825, 금산군 44710)의 데이터가 마침 1페이지에
// 없으면 실제로는 할인정책이 존재하는데도 "정책 없음(할인율 0%)"으로 잘못 표시되었다.
// 이를 해결하기 위해, 정상 포맷(할인율 필드가 인식되는 응답)이 확인된 요청 방식에 한해
// 대상 지역코드를 찾거나 마지막 페이지에 도달할 때까지 계속 다음 페이지를 조회한다.
// 서버가 지역조건(cond[usage_rgn_cd::EQ]/usage_rgn_cd/usageRegionCode)을 지원하는 경우
// 첫 페이지만으로 끝날 수 있도록, 전체조회보다 지역필터 요청을 먼저 시도한다.
async function fetchDiscountPolicies(keyCandidates,regionCodes,env){
  const endpoint=String(env.KOMSCO_SALES_POLICY_API_URL||SALES_POLICY_URL).trim();
  const codes=(Array.isArray(regionCodes)?regionCodes:[regionCodes]).filter(Boolean);
  const codeSet=new Set(codes);
  const primaryCode=codes[0]||'';
  const attempts=[
    // 서버측 지역조건을 지원하면 해당 지역 데이터만 받아오므로 페이지 수를 최소화할 수 있어 먼저 시도.
    {kind:'standard-cond',params:{page:'1',perPage:'1000','cond[usage_rgn_cd::EQ]':primaryCode,returnType:'JSON'}},
    {kind:'standard-direct',params:{page:'1',perPage:'1000',usage_rgn_cd:primaryCode,returnType:'JSON'}},
    {kind:'legacy-region',params:{pageNo:'1',numOfRows:'1000',type:'json',usageRegionCode:primaryCode}},
    // 서버가 지역조건을 지원하지 않을 때를 대비한 전체조회 폴백(페이지네이션으로 전체 순회).
    {kind:'standard-all',params:{page:'1',perPage:'1000',returnType:'JSON'}},
    {kind:'standard-all-type',params:{page:'1',perPage:'1000',type:'json'}},
    {kind:'legacy-all',params:{pageNo:'1',numOfRows:'1000',type:'json'}}
  ];
  const MAX_POLICY_PAGES=15;

  let lastDetail='',lastStatus='';
  for(const a of attempts){
    for(const key of keyCandidates){
      const pageParamKey='page' in a.params?'page':('pageNo' in a.params?'pageNo':null);
      const perPageParamKey='perPage' in a.params?'perPage':('numOfRows' in a.params?'numOfRows':null);
      const perPageNum=Number(perPageParamKey?a.params[perPageParamKey]:0)||1000;
      let formatConfirmed=false,anyRegionField=false,attemptErrorDetail='';
      const collected=[];

      for(let page=1;page<=MAX_POLICY_PAGES;page++){
        const u=new URL(endpoint);
        // URLSearchParams에 디코딩 키를 넣으면 URL 인코딩은 한 번만 적용된다.
        u.searchParams.set('serviceKey',key);
        for(const [k,v] of Object.entries(a.params))u.searchParams.set(k,String(v));
        if(pageParamKey)u.searchParams.set(pageParamKey,String(page));

        const ctrl=new AbortController();
        const timer=setTimeout(()=>ctrl.abort(),10000);
        let rr,text;
        try{
          rr=await fetch(u,{headers:{accept:'application/json, application/xml;q=0.8, text/xml;q=0.7'},signal:ctrl.signal,cache:'no-store'});
          text=await rr.text();
        }catch(e){
          attemptErrorDetail=e?.name==='AbortError'?'policy timeout':String(e?.message||e||'policy error').slice(0,160);
          break;
        }finally{clearTimeout(timer)}

        lastStatus=String(rr?.status||'');
        if(!rr?.ok){attemptErrorDetail=`HTTP ${lastStatus}`;break}

        const parsed=parsePolicyPayload(text);
        if(parsed.error){
          // 인증키 오류라면 다음 key candidate로, 잘못된 파라미터면 다음 요청형식으로 넘어간다.
          attemptErrorDetail=parsed.error;
          break;
        }

        const rawRows=extractPolicyRows(parsed.data);
        if(!rawRows.length){
          if(page===1)attemptErrorDetail=`${a.kind}: rows 0`;
          break; // 더 이상 데이터가 없는 마지막 페이지
        }

        const normalizedPage=rawRows.map(normalizePolicy).filter(x=>Number.isFinite(Number(x.discountRate)));
        if(page===1&&!normalizedPage.length){attemptErrorDetail=`${a.kind}: discount field not recognized`;break}

        formatConfirmed=true;
        collected.push(...normalizedPage);
        if(normalizedPage.some(x=>String(x.usageRegionCode||'').trim()))anyRegionField=true;

        // 자치구 단위 법정동코드가 아니라 사용코드(광역 발행지역은 상위 광역시/도 코드, 필요 시
        // 지역코드 개편 이전 과거코드까지) 후보 중 하나라도 일치하면 해당 지역 정책으로 인정한다.
        const matchedAlready=collected.some(x=>codeSet.has(String(x.usageRegionCode||'').replace(/\D/g,'').slice(0,5)));
        if(matchedAlready)break; // 대상 지역 데이터를 이미 찾았으면 더 이상 페이지를 넘기지 않는다
        if(rawRows.length<perPageNum)break; // 서버가 준 로우 수가 perPage보다 적으면 마지막 페이지
      }

      if(!formatConfirmed){lastDetail=attemptErrorDetail||lastDetail;continue}

      const exact=collected.filter(x=>codeSet.has(String(x.usageRegionCode||'').replace(/\D/g,'').slice(0,5)));
      // 응답에 지역코드 필드가 전혀 없을 때만(=서버가 이미 지역필터를 적용해 내려줬다고 볼 수 있을 때만)
      // 서버측 지역필터 요청(cond/direct/region)의 전체 응답을 신뢰한다.
      const rows=exact.length?exact:(!anyRegionField&&/cond|direct|region/.test(a.kind)?collected:[]);
      if(rows.length)return {rows,status:'ok',detail:`${a.kind}:${rows.length}`};

      lastDetail=`${a.kind}: region ${codes.join('/')} not found (checked ${collected.length} rows)`;
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
    const start=parseDate(x.startDate)||parseDate(x.referenceDate),end=parseDate(x.endDate);
    return (!start||start<=now)&&(!end||now<=end);
  });
  const candidates=active.length?active:all.filter(x=>{
    const start=parseDate(x.startDate)||parseDate(x.referenceDate);return !start||start<=now;
  });
  if(!candidates.length)return null;
  candidates.sort((a,b)=>{
    // 종료일이 없는(기준일자만 있는) 스냅샷 데이터는 기준일자가 최신인 쪽을 우선한다.
    const ae=parseDate(a.endDate)?.getTime()||parseDate(a.referenceDate)?.getTime()||parseDate(a.startDate)?.getTime()||0;
    const be=parseDate(b.endDate)?.getTime()||parseDate(b.referenceDate)?.getTime()||parseDate(b.startDate)?.getTime()||0;
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

  // 일부 응답(예: 카드·모바일 판매정책정보)은 별도의 시작/종료일 없이 "기준일자"만 내려준다.
  // 이 경우 기준일자를 참고용 시작일로 사용해, 동일 지역에 여러 스냅샷이 섞여 있어도
  // pickActiveDiscountPolicy가 가장 최신 기준일자의 정책을 우선 채택할 수 있게 한다.
  const referenceDate=String(pick(r,[
    'std_ymd','STD_YMD','base_ymd','BASE_YMD','stdDate','baseDate','기준일자','기준일'
  ])||fuzzy([/std.*ymd/,/base.*ymd/,/기준일/])||'');

  return {
    usageRegionCode:String(regionRaw||'').replace(/\D/g,'').slice(0,5),
    discountRate:numericValue(discountRaw),
    referenceDate,
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
