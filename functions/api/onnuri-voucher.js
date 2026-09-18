import {ONNURI_EXACT,ONNURI_MARKET,ONNURI_UNRESOLVED} from '../data/onnuri-seed.js';
const JSON_HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=300'};
const OFFICIAL_ONNURI_2025_URL='https://api.odcloud.kr/api/3060079/v1/uddi:7ffa42f8-01d1-4329-aa94-aefb67c53cf1';


const ONNURI_CACHE_TABLE='onnuri_geocode_cache_v1';
const ONNURI_CSV8_VERSION='2026-07-31-csv8';
const ONNURI_CSV8_REGION_FILES={
  '서울특별시':'seoul','서울':'seoul','부산광역시':'busan','부산':'busan','대구광역시':'daegu','대구':'daegu',
  '인천광역시':'incheon','인천':'incheon','광주광역시':'gwangju','광주':'gwangju','대전광역시':'daejeon','대전':'daejeon',
  '울산광역시':'ulsan','울산':'ulsan','세종특별자치시':'sejong','세종':'sejong','경기도':'gyeonggi','경기':'gyeonggi',
  '강원특별자치도':'gangwon','강원도':'gangwon','강원':'gangwon','충청북도':'chungbuk','충북':'chungbuk',
  '충청남도':'chungnam','충남':'chungnam','전북특별자치도':'jeonbuk','전라북도':'jeonbuk','전북':'jeonbuk',
  '전라남도':'jeonnam','전남':'jeonnam','경상북도':'gyeongbuk','경북':'gyeongbuk','경상남도':'gyeongnam','경남':'gyeongnam',
  '제주특별자치도':'jeju','제주':'jeju'
};
const ONNURI_CSV8_MEMORY=new Map();

const FORCED_ONNURI_MERCHANTS=[{"id":"forced:sodammasilgil:wonjobuanjip-sodam","city":"세종특별자치시","district":"","town":"소담동","market":"소담마실길 골목형상점가","name":"원조부안집 소담점","address":"세종특별자치시 소담로 93 (소담동) 104 105","category":"음식점","paper":true,"digital":true,"forced":true,"verifiedAt":"2026-09-16"},{"id":"forced:sodam:yesan-guksu","city":"세종특별자치시","district":"","town":"소담동","market":"소담마실길 골목형상점가","name":"예산국수 소담점","address":"세종특별자치시 한누리대로 2018 (소담동) 사이언스타운 103호","category":"음식점","paper":true,"digital":true,"forced":true,"verifiedAt":"2026-09-16"},{"id":"forced:sodam:isac-toast","city":"세종특별자치시","district":"","town":"소담동","market":"소담마실길 골목형상점가","name":"이삭토스트 세종 소담점","address":"세종특별자치시 한누리대로 2018 (소담동) 사이언스타운 113호","category":"분식","paper":true,"digital":true,"forced":true,"verifiedAt":"2026-09-16"},{"id":"forced:sodam:dakjangsu","city":"세종특별자치시","district":"","town":"소담동","market":"소담마실길 골목형상점가","name":"닭장수후라이드 소담점","address":"세종특별자치시 한누리대로 2022 (소담동) 1층 101호","category":"음식점","paper":true,"digital":true,"forced":true,"verifiedAt":"2026-09-16"},{"id":"forced:sodam:sobok","city":"세종특별자치시","district":"","town":"소담동","market":"소담마실길 골목형상점가","name":"소복반점","address":"세종특별자치시 한누리대로 2003 (소담동) 206호","category":"음식점","paper":true,"digital":true,"forced":true,"verifiedAt":"2026-09-16"},{"id":"forced:sodam:daehan-gopchang","city":"세종특별자치시","district":"","town":"소담동","market":"소담마실길 골목형상점가","name":"군자대한곱창 세종소담점","address":"세종특별자치시 한누리대로 1966 (소담동) 103~104호","category":"음식점","paper":true,"digital":true,"forced":true,"verifiedAt":"2026-09-16"},{"id":"forced:sodam:eunhee-haejangguk","city":"세종특별자치시","district":"","town":"소담동","market":"소담마실길 골목형상점가","name":"제주은희네해장국 세종소담점","address":"세종특별자치시 법원2로 12 (소담동) 115~117호","category":"음식점","paper":true,"digital":true,"forced":true,"verifiedAt":"2026-09-16"},{"id":"forced:mannyeon:sinchon-seolleongtang","city":"대전광역시","district":"서구","town":"만년동","market":"만년동 골목형상점가","name":"신촌설렁탕 만년점","address":"대전광역시 서구 대덕대로 390 (만년동)","category":"음식점","paper":true,"digital":true,"forced":true,"verifiedAt":"2026-09-16"},{"id":"forced:mannyeon:friends-academy","city":"대전광역시","district":"서구","town":"만년동","market":"만년동 골목형상점가","name":"프렌즈아카데미 대전만년점","address":"대전광역시 서구 만년로 69 (만년동) 2~3층","category":"골프연습장","paper":true,"digital":true,"forced":true,"verifiedAt":"2026-09-16"},{"id":"forced:mannyeon:kims-piano","city":"대전광역시","district":"서구","town":"만년동","market":"만년동 골목형상점가","name":"킴스피아노","address":"대전광역시 서구 대덕대로 408 (만년동, 테크노월드) 2층","category":"악기","paper":true,"digital":true,"forced":true,"verifiedAt":"2026-09-16"},{"id":"forced:mannyeon:samo","city":"대전광역시","district":"서구","town":"만년동","market":"만년동 골목형상점가","name":"삼오식당","address":"대전광역시 서구 만년로 70 (만년동)","category":"음식점","paper":true,"digital":true,"forced":true,"verifiedAt":"2026-09-16"},{"id":"forced:mannyeon:uncle-budae","city":"대전광역시","district":"서구","town":"만년동","market":"만년동 골목형상점가","name":"엉클부대찌개 만년점","address":"대전광역시 서구 만년로 79 (만년동) 1층 104호","category":"음식점","paper":true,"digital":true,"forced":true,"verifiedAt":"2026-09-16"},{"id":"forced:mannyeon:sg-screen","city":"대전광역시","district":"서구","town":"만년동","market":"만년동 골목형상점가","name":"SG스크린골프 만년점","address":"대전광역시 서구 둔산대로117번길 95 (만년동, 리더스타운) B동 101호","category":"골프연습장","paper":true,"digital":true,"forced":true,"verifiedAt":"2026-09-16"},{"id":"forced:mannyeon:wash-enjoy","city":"대전광역시","district":"서구","town":"만년동","market":"만년동 골목형상점가","name":"워시엔조이 셀프빨래방 대전만년점","address":"대전광역시 서구 만년남로3번길 49 (만년동)","category":"세탁","paper":true,"digital":true,"forced":true,"verifiedAt":"2026-09-16"}];

function shouldInjectForcedMerchant(x,region){
  const city=normalizeText(region?.city);
  const district=normalizeText(region?.district);
  const town=normalizeText(region?.town);
  const targetCity=normalizeText(x.city);
  const targetDistrict=normalizeText(x.district);
  const targetTown=normalizeText(x.town);

  if(city && targetCity && !city.includes(targetCity) && !targetCity.includes(city))return false;
  if(district && targetDistrict && !district.includes(targetDistrict) && !targetDistrict.includes(district))return false;
  if(town && targetTown && !town.includes(targetTown) && !targetTown.includes(town))return false;
  return true;
}


async function ensureOnnuriCacheTable(env){
  const db=env?.DB||env?.D1||env?.JOFAMS_DB;
  if(!db)return null;
  try{
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS ${ONNURI_CACHE_TABLE} (
        cache_key TEXT PRIMARY KEY,
        region TEXT,
        market TEXT,
        merchant TEXT,
        lng REAL NOT NULL,
        lat REAL NOT NULL,
        precision TEXT,
        matched_place_name TEXT,
        matched_address TEXT,
        geocoded_at TEXT NOT NULL
      )
    `).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_${ONNURI_CACHE_TABLE}_market ON ${ONNURI_CACHE_TABLE}(market)`).run();
    return db;
  }catch(e){
    console.warn('onnuri cache table init failed',e);
    return null;
  }
}
function onnuriCacheKey(region,market,merchant){
  return normalizeText([region,market,merchant].filter(Boolean).join('|'));
}
async function readOnnuriCache(db,key){
  if(!db||!key)return null;
  try{
    return await db.prepare(`SELECT * FROM ${ONNURI_CACHE_TABLE} WHERE cache_key=?1`).bind(key).first();
  }catch{return null}
}
async function writeOnnuriCache(db,row){
  if(!db||!row?.cache_key||!validKorea(row.lat,row.lng))return;
  try{
    await db.prepare(`
      INSERT INTO ${ONNURI_CACHE_TABLE}
      (cache_key,region,market,merchant,lng,lat,precision,matched_place_name,matched_address,geocoded_at)
      VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)
      ON CONFLICT(cache_key) DO UPDATE SET
        lng=excluded.lng,
        lat=excluded.lat,
        precision=excluded.precision,
        matched_place_name=excluded.matched_place_name,
        matched_address=excluded.matched_address,
        geocoded_at=excluded.geocoded_at
    `).bind(
      row.cache_key,row.region||'',row.market||'',row.merchant||'',
      row.lng,row.lat,row.precision||'',row.matched_place_name||'',row.matched_address||'',
      row.geocoded_at||new Date().toISOString()
    ).run();
  }catch(e){console.warn('onnuri cache write failed',e)}
}


function cityAliases(city){
  const c=String(city||'').trim();
  if(!c)return [];
  if(c.includes('대전'))return ['대전광역시','대전'];
  if(c.includes('세종'))return ['세종특별자치시','세종'];
  return [c];
}
function detailedAddress(v){
  const s=String(v||'').trim();
  if(!s)return false;
  // 단순 시·도명("대전", "세종")은 상세주소로 취급하지 않는다.
  if(/^(대전|대전광역시|세종|세종특별자치시)$/.test(s))return false;
  return /\d/.test(s) || /(로|길|대로|번길|동|읍|면|구)\b/.test(s);
}
function loadBundledOnnuri(){
  return [...ONNURI_EXACT,...ONNURI_MARKET,...ONNURI_UNRESOLVED].map(x=>({
    '가맹점명':x.merchant||'',
    '소속 시장명(또는 상점가)':x.market||'',
    '소재지':x.address||x.region||'',
    '지류형 가맹 여부':x.paper?'Y':'N',
    '디지털형 가맹 여부':x.digital?'Y':'N',
    '__addressSource':x.addressSource||'unresolved',
    '__region':x.region||'',
    '__bundled':true
  }));
}


function onnuriCsv8RegionKey(city){
  const raw=String(city||'').trim();
  if(!raw)return '';
  if(ONNURI_CSV8_REGION_FILES[raw])return ONNURI_CSV8_REGION_FILES[raw];
  const found=Object.keys(ONNURI_CSV8_REGION_FILES).find(k=>raw.includes(k)||k.includes(raw));
  return found?ONNURI_CSV8_REGION_FILES[found]:'';
}
async function loadCsv8Onnuri(request,env,city){
  const key=onnuriCsv8RegionKey(city);
  if(!key)return [];
  const assetUrl=new URL(`/data/onnuri-20260731/${key}.json`,request.url);
  let response=null;
  try{
    let payload=ONNURI_CSV8_MEMORY.get(key)||null;
    if(!payload){
      if(env?.ASSETS?.fetch)response=await env.ASSETS.fetch(new Request(assetUrl.toString(),{headers:{accept:'application/json'}}));
      else response=await fetch(assetUrl.toString(),{headers:{accept:'application/json'}});
      if(!response?.ok)return [];
      payload=await response.json();
      if(payload?.version===ONNURI_CSV8_VERSION&&Array.isArray(payload?.items))ONNURI_CSV8_MEMORY.set(key,payload);
    }
    if(payload?.version!==ONNURI_CSV8_VERSION||!Array.isArray(payload?.items))return [];
    const regionName=String(payload.region||city||'').trim();
    return payload.items.map(x=>({
      '가맹점명':String(x?.n||'').trim(),
      '소속 시장명(또는 상점가)':String(x?.m||'').trim(),
      '소재지':String(x?.a||'').trim(),
      '취급품목':String(x?.c||'').trim(),
      '지류형 가맹 여부':x?.p?'Y':'N',
      '디지털형 가맹 여부':x?.d?'Y':'N',
      '가맹 등록년도':String(x?.y||'').trim(),
      '__addressSource':x?.s==='market'?'official-market':'csv8-merchant-exact',
      '__region':regionName,
      '__bundled':true,
      '__csv8':true
    }));
  }catch(e){
    console.warn('onnuri csv8 asset load failed',key,e?.message||e);
    return [];
  }
}

export async function onRequestGet({request,env}){
  const q=new URL(request.url);
  const west=num(q.searchParams.get('west')),south=num(q.searchParams.get('south'));
  const east=num(q.searchParams.get('east')),north=num(q.searchParams.get('north'));
  const lng=num(q.searchParams.get('lng')),lat=num(q.searchParams.get('lat'));
  const source=String(env.ONNURI_MERCHANT_DATA_URL||OFFICIAL_ONNURI_2025_URL).trim();
  const serviceKey=normalizeServiceKey(env.PUBLIC_DATA_SERVICE_KEY||env.DATA_GO_KR_SERVICE_KEY||env.ONNURI_SERVICE_KEY||'');
  const kakaoKey=String(env.KAKAO_REST_API_KEY||'').trim();
  const geocodeDb=await ensureOnnuriCacheTable(env);

  try{
    const region=(await resolveRegion(lat,lng,kakaoKey))||coarseRegionFromCoordinate(lat,lng);
    const aliases=cityAliases(region?.city);
    const regionWords=[region?.district,region?.town,...aliases].filter(Boolean);
    const locality=region?.district||aliases[0]||region?.city||'';
    let rows=[],fetchMeta={mode:'none',pages:0,totalCount:0,query:''};

    if(serviceKey && /api\.odcloud\.kr/i.test(new URL(source).hostname) && locality){
      const filtered=await fetchOdcloudFiltered(source,serviceKey,locality);

      // ODCLOUD 자동변환 API의 Swagger에는 page/perPage/returnType만 명시되어 있고,
      // cond[소재지::LIKE]가 실제로 무시되는 데이터셋이 있다.
      // 따라서 '응답이 왔다'가 아니라 실제 소재지/시장명에 locality가 들어있는지 검증한다.
      const verified=filterRowsByRegion(filtered.rows,[locality]);
      if(verified.length){
        rows=verified;
        fetchMeta={...filtered.meta,verified:true,verifiedCount:verified.length};
      }else{
        fetchMeta={...filtered.meta,verified:false,verifiedCount:0,filterIgnored:true};
      }

      if(!rows.length && region?.city && region.city!==locality){
        const byCity=await fetchOdcloudFiltered(source,serviceKey,region.city);
        const verifiedCity=filterRowsByRegion(byCity.rows,[region.city]);
        if(verifiedCity.length){
          rows=verifiedCity;
          fetchMeta={...byCity.meta,fallback:'city',verified:true,verifiedCount:verifiedCity.length};
        }
      }
    }

    // 서버측 조건검색이 실제로 적용되지 않으면 전국 데이터를 페이지 단위로 스캔한다.
    // 전체 행을 한 번에 누적하지 않고 8페이지씩 병렬 조회 후 현재 시/군/구 주소만 모으고,
    // 충분한 지역 데이터가 확보되면 즉시 종료한다.
    if(serviceKey && !rows.length){
      const all=await scanOdcloudForRegion(source,serviceKey,{
        regionWords,
        maxPages:220,
        perPage:1000,
        batchSize:8,
        targetMatches:320
      });
      rows=all.rows;fetchMeta=all.meta;
    }


    // 7.6.5.4: 앱에 내장된 대전·세종 주소 데이터 3종을 항상 우선 병합한다.
    // 공공데이터 API 키/조건검색 오류가 있어도 실제주소·대표주소·미확인 목록을 사용할 수 있다.
    const csv8Rows=await loadCsv8Onnuri(request,env,region?.city);
    const bundledRows=loadBundledOnnuri();
    // 8차 보강 CSV의 개별주소/공식 시장대표주소를 가장 먼저 병합한다.
    // 동일 시장+가맹점이 중복될 경우 아래 dedup 로직에서 CSV8 행이 우선 유지된다.
    if(csv8Rows.length||bundledRows.length)rows=[...csv8Rows,...bundledRows,...rows];

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
      lat:num(pick(row,['위도','latitude','lat','y','Y'])),
      addressSource:String(row.__addressSource||''),
      bundled:Boolean(row.__bundled),
      bundledRegion:String(row.__region||''),
      csv8:Boolean(row.__csv8)
    })).filter(x=>x.name||x.address);

    let local=normalized;
    if(regionWords.length){
      local=normalized.filter(x=>{
        const t=`${x.address} ${x.market} ${x.bundledRegion}`;
        return regionWords.some(w=>w&&t.includes(w));
      });
    }

    // 번들 실주소를 우선하고 동일 상점가+가맹점 중복 제거.
    const dedup=new Map();
    for(const x of local){
      const k=`${normalizeText(x.market)}|${normalizeText(x.name)}`;
      if(!dedup.has(k) || (x.bundled && !dedup.get(k)?.bundled))dedup.set(k,x);
    }
    local=[...dedup.values()];
    const localTerms=[region?.town,region?.district].filter(Boolean);
    local.sort((a,b)=>{
      const score=x=>{
        const t=`${x.address} ${x.market}`;
        if(localTerms.some(w=>w&&t.includes(w)))return 0;
        if(x.addressSource==='legacy-merchant-exact'||x.addressSource==='user-confirmed'||x.addressSource==='csv8-merchant-exact')return 1;
        if(x.addressSource==='official-market'||x.addressSource==='market-reference')return 2;
        return 3;
      };
      return score(a)-score(b);
    });

    // 7.6.4.8: 상세 도로명주소가 누락된 온누리 원천데이터를
    // [지역 + 상점가명 + 가맹점명] 중심의 다단계 Kakao Keyword Search로 좌표화한다.
    // 개별 가맹점 검색이 실패할 때만 상점가/행정구역 대표 위치로 fallback한다.
    // 7.6.5.0: 사용자가 확인한 소담동 온누리 가맹점을 원천 API 누락 여부와 무관하게 강제 포함.
    // 상세 도로명주소가 있으므로, 아래 매핑 단계에서 주소 지오코딩을 최우선으로 사용한다.
    for(const forced of FORCED_ONNURI_MERCHANTS){
      if(!shouldInjectForcedMerchant(forced,region))continue;
      const dup=local.some(x=>
        normalizeText(x.name)===normalizeText(forced.name) &&
        normalizeText(x.market)===normalizeText(forced.market)
      );
      if(!dup)local.unshift({...forced});
    }

    local=local.slice(0,260);

    const marketCenterCache=new Map();
    const adminCenterCache=new Map();

    async function marketCenter(market){
      const key=String(market||'').trim();
      if(!key)return null;
      if(marketCenterCache.has(key))return marketCenterCache.get(key);
      let p=null;
      if(kakaoKey){
        const queries=[
          [region?.city,region?.district,key].filter(Boolean).join(' '),
          [region?.city,key].filter(Boolean).join(' '),
          key
        ];
        for(const query of queries){
          const hit=await searchPlaceValidated(query,kakaoKey,region);
          if(hit){p={...hit,coordinateSource:'kakao-market-keyword'};break}
        }
      }
      marketCenterCache.set(key,p);
      return p;
    }

    async function adminCenter(){
      const label=[region?.city,region?.district,region?.town].filter(Boolean).join(' ');
      if(adminCenterCache.has(label))return adminCenterCache.get(label);
      let p=null;
      if(kakaoKey && label){
        const g=await geocode(label,kakaoKey);
        if(g&&validKorea(g.lat,g.lng))p={...g,coordinateSource:'kakao-admin-geocode'};
        if(!p){
          const hit=await searchPlaceValidated(label,kakaoKey,region);
          if(hit)p={...hit,coordinateSource:'kakao-admin-keyword'};
        }
      }
      adminCenterCache.set(label,p);
      return p;
    }

    const mapped=await mapLimit(local,5,async x=>{
      const market=(x.market||'').trim();
      const merchant=(x.name||'').trim();
      const regionFull=[region?.city,region?.district,region?.town].filter(Boolean).join(' ');
      const regionMid=[region?.city,region?.district].filter(Boolean).join(' ');

      let point=null;
      let precision='';
      let matchedPlaceName='';
      let matchedAddress='';
      let searchQuery='';

      const cacheRegion=region?.city||regionFull;
      const cacheKey=onnuriCacheKey(cacheRegion,market,merchant);

      // 7.6.8: 관리자 '온누리 가맹점 주소 좌표화' 배치가 미리 채워둔 D1 캐시를 최우선으로 사용한다.
      // 이렇게 하면 매 홈 화면 요청마다 Kakao API를 개별 호출하지 않아도 되고(속도/쿼터 문제로
      // 좌표화가 실패해 가맹점이 아예 표시되지 않는 상황을 막을 수 있다), 배치가 아직 처리하지
      // 않은 신규 가맹점만 아래에서 실시간 지오코딩으로 보완한다.
      const cached=await readOnnuriCache(geocodeDb,cacheKey);
      if(cached&&validKorea(num(cached.lat),num(cached.lng))){
        point={lng:num(cached.lng),lat:num(cached.lat)};
        precision=String(cached.precision||'cached');
        matchedPlaceName=String(cached.matched_place_name||'');
        matchedAddress=String(cached.matched_address||'');
        searchQuery='D1_CACHE';
      }

      // 캐시에 없는 가맹점만 실시간 좌표화를 시도한다(관리자 배치가 아직 처리 전인 신규 항목).
      // 강제등록/상세주소 보유 행은 주소 지오코딩을 우선 적용한다.
      if(!point && detailedAddress(x.address) && kakaoKey){
        const addressQuery=String(x.address).replace(/\([^)]*\)/g,' ').replace(/\s+/g,' ').trim();
        const g=await geocode(addressQuery,kakaoKey);
        if(g&&validKorea(g.lat,g.lng)){
          point={lng:g.lng,lat:g.lat};
          const isMarketFallback=x.addressSource==='official-market'||x.addressSource==='market-reference';
          precision=isMarketFallback?'market-zone':'exact-address-geocode';
          matchedPlaceName=isMarketFallback?(market||merchant):merchant;
          matchedAddress=x.address;
          searchQuery=isMarketFallback?'MARKET_ADDRESS_GEOCODE':'ADDRESS_GEOCODE';
        }
      }

      if(!point && kakaoKey && merchant){
        const queries=[
          [regionFull,market,merchant].filter(Boolean).join(' '),
          [regionMid,market,merchant].filter(Boolean).join(' '),
          [regionMid,merchant].filter(Boolean).join(' '),
          [market,merchant].filter(Boolean).join(' ')
        ].filter(Boolean);

        const seen=new Set();
        for(const q of queries){
          if(seen.has(q))continue;
          seen.add(q);
          const hit=await searchMerchantPlace(q,kakaoKey,{region,market,merchant});
          if(hit){
            point={lng:hit.lng,lat:hit.lat};
            precision=hit.precision||'merchant-keyword';
            matchedPlaceName=hit.placeName||'';
            matchedAddress=hit.address||'';
            searchQuery=q;
            break;
          }
        }
      }

      // 원천 데이터에 유효한 좌표가 실제로 포함된 행은 그대로 사용하되,
      // keyword 검색 결과보다 우선하지 않는다.
      if(!point && validKorea(x.lat,x.lng)){
        point={lng:x.lng,lat:x.lat};
        precision='source-coordinate';
        matchedPlaceName=merchant;
        matchedAddress=x.address||'';
      }

      // 개별 점포를 못 찾으면 시장/상점가 대표 위치를 사용
      if(!point && market){
        const m=await marketCenter(market);
        if(m){
          point={lng:m.lng,lat:m.lat};
          precision='market-zone';
          matchedPlaceName=m.placeName||market;
          matchedAddress=m.address||'';
        }
      }

      // 상점가 자체도 못 찾는 경우 현 행정구역 대표 위치를 최종 fallback
      if(!point){
        const a=await adminCenter();
        if(a){
          point={lng:a.lng,lat:a.lat};
          precision='admin-zone';
          matchedPlaceName=regionFull||regionMid;
          matchedAddress=regionFull||regionMid;
        }
      }

      if(!point||!validKorea(point.lat,point.lng))return null;

      // 요청된 지도권역에서 너무 멀리 벗어난 오탐 제거
      if([west,south,east,north].every(Number.isFinite)){
        const pad=.06;
        if(point.lng<west-pad||point.lng>east+pad||point.lat<south-pad||point.lat>north+pad)return null;
      }

      if(searchQuery!=='D1_CACHE' && precision && validKorea(point.lat,point.lng)){
        await writeOnnuriCache(geocodeDb,{
          cache_key:cacheKey,
          region:cacheRegion,
          market,
          merchant,
          lng:point.lng,
          lat:point.lat,
          precision,
          matched_place_name:matchedPlaceName,
          matched_address:matchedAddress,
          geocoded_at:new Date().toISOString()
        });
      }

      return {
        id:x.id||`${merchant}:${market}`,
        name:merchant||'온누리상품권 가맹점',
        market,
        address:x.address||'',
        category:x.category,
        city:x.city||region?.city||'',
        district:x.district||region?.district||'',
        town:x.town||region?.town||'',
        paper:x.paper,
        digital:x.digital,
        registeredYear:x.registeredYear,
        lng:point.lng,
        lat:point.lat,
        precision,
        coordinateSource:precision,
        matchedPlaceName,
        matchedAddress,
        searchQuery,
        approximate:precision==='market-zone'||precision==='admin-zone',
        source:x.forced?'manual-forced':(x.csv8?'semas-onnuri-2026-csv8':'semas-onnuri-2025'),
        addressType:x.addressSource==='official-market'||x.addressSource==='market-reference'?'market':'merchant',
        forced:Boolean(x.forced)
      };
    });

    let items=mapped.filter(Boolean);

    // 최소 가시성 보장:
    // 정상 좌표화가 0건이어도 현재 조회 지역에 온누리 원천 행이 있다면
    // 행정구역 대표좌표에 최소 1건의 '구역 대표' 항목을 만들어 지도/목록이 완전히 비지 않게 한다.
    if(!items.length && local.length){
      const a=await adminCenter();
      if(a&&validKorea(a.lat,a.lng)){
        const sample=local[0];
        items=[{
          id:`fallback:${region?.city||''}:${region?.district||''}:${region?.town||''}`,
          name:sample?.market||`${region?.town||region?.district||region?.city||'현재 지역'} 온누리상품권`,
          market:sample?.market||'',
          address:'',
          category:'',
          city:region?.city||'',
          district:region?.district||'',
          town:region?.town||'',
          paper:false,
          digital:false,
          registeredYear:'',
          lng:a.lng,
          lat:a.lat,
          precision:'admin-zone',
          coordinateSource:'admin-zone',
          matchedPlaceName:[region?.city,region?.district,region?.town].filter(Boolean).join(' '),
          matchedAddress:[region?.city,region?.district,region?.town].filter(Boolean).join(' '),
          searchQuery:'MIN_VISIBLE_FALLBACK',
          approximate:true,
          source:'semas-onnuri-2025',
          fallbackCount:local.length
        }];
      }
    }

    // 상점가 대표 fallback을 사용한 점포는 같은 좌표로 다수 겹칠 수 있으므로
    // 시장/상점가별 구역 집계도 함께 제공한다.
    const zoneMap=new Map();
    for(const x of items){
      if(!(x.precision==='market-zone'||x.precision==='admin-zone'))continue;
      const key=x.market||x.matchedAddress||`${region?.district||region?.city||'온누리'} 구역`;
      if(!zoneMap.has(key))zoneMap.set(key,{
        id:`zone:${key}`,
        name:key,
        market:key,
        regionLabel:[region?.city,region?.district,region?.town].filter(Boolean).join(' '),
        count:0,
        lng:x.lng,
        lat:x.lat,
        approximate:true,
        locationPrecision:x.precision
      });
      zoneMap.get(key).count++;
    }
    const zones=[...zoneMap.values()];

    return json({
      ok:true,
      configured:true,
      publicDataConfigured:Boolean(serviceKey),
      bundledDataEnabled:true,
      provider:'소상공인시장진흥공단 전국 온누리상품권 가맹점 현황 2026-07-31 주소보강 8차 + 공공데이터 API',
      datasetUrl:OFFICIAL_ONNURI_2025_URL,
      bundledCsv8Version:ONNURI_CSV8_VERSION,
      bundledCsv8Rows:csv8Rows.length,
      region:{city:region?.city||'',district:region?.district||'',town:region?.town||''},
      fetchedRows:rows.length,
      localRows:local.length,
      mappedRows:items.length,
      preciseMerchantCount:items.filter(x=>x.precision==='exact-address-geocode'||x.precision==='merchant-keyword'||x.precision==='merchant-keyword-relaxed'||x.precision==='source-coordinate').length,
      fallbackZoneCount:items.filter(x=>x.precision==='market-zone'||x.precision==='admin-zone').length,
      cacheEnabled:Boolean(geocodeDb),
      minimumVisibleFallback:items.some(x=>x.searchQuery==='MIN_VISIBLE_FALLBACK'),
      locationPrecision:'mixed',
      notice:'주소보강 8차의 개별 가맹점 주소를 우선 사용하며, 개별주소가 없는 경우 공식 시장·상점가 대표주소 또는 지역+상점가+가맹점명 검색을 사용합니다.',
      fetchMeta,
      zones,
      items
    },200);
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

function rowRegionText(row){
  return `${String(pick(row,['소재지','주소','가맹점주소','도로명주소','지번주소','address','addr'])||'')} ${String(pick(row,['소속 시장명(또는 상점가)','소속 시장명','시장명','전통시장명','market'])||'')}`;
}
function filterRowsByRegion(rows,words){
  const ws=(words||[]).map(x=>String(x||'').trim()).filter(Boolean);
  if(!ws.length)return rows||[];
  return (rows||[]).filter(row=>{
    const t=rowRegionText(row);
    return ws.some(w=>t.includes(w));
  });
}
async function scanOdcloudForRegion(source,key,{regionWords=[],maxPages=220,perPage=1000,batchSize=8,targetMatches=320}={}){
  const rows=[];let pages=0,totalCount=null,seen=0;
  const words=(regionWords||[]).map(x=>String(x||'').trim()).filter(Boolean);
  for(let start=1;start<=maxPages;start+=batchSize){
    const pageNos=Array.from({length:Math.min(batchSize,maxPages-start+1)},(_,i)=>start+i);
    const results=await Promise.all(pageNos.map(async page=>{
      try{
        const u=buildOdcloudUrl(source,key,page,perPage);
        const d=await fetchOdcloudPage(u);
        return {page,d,data:arrayData(d)};
      }catch(e){
        return {page,error:String(e?.message||e),data:[]};
      }
    }));

    for(const r of results){
      pages++;
      seen+=r.data.length;
      if(totalCount==null && r.d){
        const n=Number(r.d.totalCount??r.d.matchCount);
        if(Number.isFinite(n))totalCount=n;
      }
      const matched=filterRowsByRegion(r.data,words);
      if(matched.length)rows.push(...matched);
    }

    if(rows.length>=targetMatches)break;
    if(Number.isFinite(totalCount) && seen>=totalCount)break;
    if(results.every(r=>r.data.length<perPage))break;
  }
  return {rows,meta:{mode:'batched-region-scan',pages,totalCount,seen,matched:rows.length,regionWords:words}};
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

function coarseRegionFromCoordinate(lat,lng){
  if(!Number.isFinite(lat)||!Number.isFinite(lng))return null;
  // Kakao 역지오코딩 실패 시 최소한 광역시 단위 데이터는 찾을 수 있도록 하는 안전망.
  const boxes=[
    ['서울특별시','서울',37.40,37.72,126.75,127.20],
    ['부산광역시','부산',34.95,35.40,128.75,129.35],
    ['대구광역시','대구',35.65,36.05,128.35,128.85],
    ['인천광역시','인천',37.20,37.70,126.25,126.85],
    ['광주광역시','광주',35.00,35.30,126.65,127.05],
    ['대전광역시','대전',36.20,36.50,127.20,127.55],
    ['울산광역시','울산',35.35,35.75,129.00,129.50],
    ['세종특별자치시','세종',36.40,36.75,127.10,127.45]
  ];
  for(const [city,district,minLat,maxLat,minLng,maxLng] of boxes){
    if(lat>=minLat&&lat<=maxLat&&lng>=minLng&&lng<=maxLng)return{city,district,town:'',coarse:true};
  }
  return null;
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


function normalizeText(v){
  return String(v||'').replace(/\s+/g,'').replace(/[()·ㆍ\-_]/g,'').toLowerCase();
}
function regionMatchesDoc(doc,region){
  const hay=normalizeText(`${doc?.address_name||''} ${doc?.road_address_name||''}`);
  const city=normalizeText(region?.city);
  const district=normalizeText(region?.district);
  if(city && !hay.includes(city))return false;
  if(district && !hay.includes(district))return false;
  return true;
}
function merchantNameScore(placeName,merchant,market){
  const p=normalizeText(placeName),m=normalizeText(merchant),mk=normalizeText(market);
  let score=0;
  if(m && p===m)score+=100;
  else if(m && (p.includes(m)||m.includes(p)))score+=70;
  if(mk && p.includes(mk))score+=15;
  return score;
}
async function searchMerchantPlace(query,key,{region,market,merchant}={}){
  if(!query||!key)return null;
  try{
    const u=new URL('https://dapi.kakao.com/v2/local/search/keyword.json');
    u.searchParams.set('query',query);
    u.searchParams.set('size','15');
    const r=await fetch(u,{headers:{Authorization:`KakaoAK ${key}`}});if(!r.ok)return null;
    const d=await r.json();
    const docs=(d.documents||[]).filter(x=>validKorea(num(x.y),num(x.x)));
    if(!docs.length)return null;

    // 지역이 명확히 맞는 후보를 우선 사용하고, 점포명 유사도로 정렬
    const regional=docs.filter(x=>regionMatchesDoc(x,region));
    const pool=regional.length?regional:docs;
    const ranked=pool.map(x=>({
      x,
      score:merchantNameScore(x.place_name,merchant,market)
    })).sort((a,b)=>b.score-a.score);

    const best=ranked[0];
    if(!best)return null;

    // 지역 일치 후보가 없거나 점포명 유사도가 지나치게 낮으면 오탐 방지를 위해 버림
    if(!regional.length)return null;
    if(best.score<55)return null;

    return {
      lng:num(best.x.x),
      lat:num(best.x.y),
      placeName:String(best.x.place_name||'').trim(),
      address:String(best.x.road_address_name||best.x.address_name||'').trim(),
      precision:best.score>=90?'merchant-keyword':'merchant-keyword-relaxed'
    };
  }catch{return null}
}
async function searchPlaceValidated(query,key,region){
  if(!query||!key)return null;
  try{
    const u=new URL('https://dapi.kakao.com/v2/local/search/keyword.json');
    u.searchParams.set('query',query);
    u.searchParams.set('size','10');
    const r=await fetch(u,{headers:{Authorization:`KakaoAK ${key}`}});if(!r.ok)return null;
    const d=await r.json();
    const docs=(d.documents||[]).filter(x=>validKorea(num(x.y),num(x.x)));
    if(!docs.length)return null;
    const regional=docs.filter(x=>regionMatchesDoc(x,region));
    const x=(regional[0]||docs[0]);
    if(!x)return null;
    return {
      lng:num(x.x),lat:num(x.y),
      placeName:String(x.place_name||'').trim(),
      address:String(x.road_address_name||x.address_name||'').trim()
    };
  }catch{return null}
}

async function searchPlace(query,key){
  if(!query||!key)return null;
  try{
    const u=new URL('https://dapi.kakao.com/v2/local/search/keyword.json');
    u.searchParams.set('query',query);
    u.searchParams.set('size','5');
    const r=await fetch(u,{headers:{Authorization:`KakaoAK ${key}`}});if(!r.ok)return null;
    const d=await r.json(),docs=d.documents||[];
    if(!docs.length)return null;
    const x=docs[0];
    const lng=num(x.x),lat=num(x.y);
    return validKorea(lat,lng)?{lng,lat,name:String(x.place_name||'').trim()}:null;
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
