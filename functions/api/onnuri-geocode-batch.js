import {ONNURI_EXACT,ONNURI_MARKET,ONNURI_UNRESOLVED} from '../data/onnuri-seed.js';
const ADMIN_EMAIL='churchoffire@gmail.com';
const TABLE='onnuri_geocode_cache_v1';
const PROGRESS_TABLE='onnuri_geocode_batch_progress_v1';

export async function onRequest({request,env}){
  if(!env.DB)return json({ok:false,error:'D1 binding DB is not configured'},503);
  const user=await requireFirebaseUser(request,env);
  if(!user)return json({ok:false,error:'login required'},401);
  if(String(user.email||'').toLowerCase()!==ADMIN_EMAIL)return json({ok:false,error:'admin required'},403);

  await ensureSchema(env.DB);
  const exact=ONNURI_EXACT;
  const market=ONNURI_MARKET;
  const unresolved=ONNURI_UNRESOLVED;

  if(request.method==='GET'){
    const cached=await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${TABLE}`).first();
    const precise=await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${TABLE} WHERE precision IN ('exact-address-geocode','merchant-keyword','merchant-keyword-relaxed')`).first();

    // 이전 버전에서 이미 진행한 배치도 가능한 한 이어받는다.
    // progress 테이블이 비어 있으면 기존 D1 캐시 수를 순차 처리량으로 환산해 1회 bootstrap 한다.
    await bootstrapProgressIfEmpty(env.DB,{
      exact:exact.length,
      market:market.length,
      unresolved:unresolved.length
    },Number(cached?.n||0));

    const progress=await readProgress(env.DB,{
      exact:exact.length,
      market:market.length,
      unresolved:unresolved.length
    });

    return json({
      ok:true,
      exactTotal:exact.length,
      marketFallbackTotal:market.length,
      unresolvedTotal:unresolved.length,
      total:exact.length+market.length+unresolved.length,
      cached:Number(cached?.n||0),
      precise:Number(precise?.n||0),
      maxBatch:30,
      progress
    });
  }

  if(request.method!=='POST')return json({ok:false,error:'method not allowed'},405);
  if(!env.KAKAO_REST_API_KEY)return json({ok:false,error:'KAKAO_REST_API_KEY is not configured'},503);

  const body=await request.json().catch(()=>({}));
  const stage=String(body.stage||'exact');
  const requestedCursor=Math.max(0,Number(body.cursor)||0);
  const limit=Math.max(1,Math.min(30,Number(body.limit)||20));

  let list,mode;
  if(stage==='exact'){list=exact;mode='exact'}
  else if(stage==='market'){list=market;mode='market'}
  else if(stage==='unresolved'){list=unresolved;mode='unresolved'}
  else return json({ok:false,error:'invalid stage'},400);

  const savedProgress=await env.DB.prepare(`SELECT cursor FROM ${PROGRESS_TABLE} WHERE stage=?`).bind(stage).first();
  const savedCursor=Math.max(0,Math.min(list.length,Number(savedProgress?.cursor||0)));
  // 서버에 저장된 진행위치보다 뒤로 가지 않는다. 클라이언트가 오래된 값(0)을 보내도 이어서 처리.
  const cursor=Math.max(savedCursor,Math.min(list.length,requestedCursor));
  const slice=list.slice(cursor,cursor+limit);
  let cachedHits=0,searched=0,success=0,failed=0;
  const results=[];

  for(const row of slice){
    const key=cacheKey(row.region,row.market,row.merchant);
    const cached=await env.DB.prepare(`SELECT cache_key,lng,lat,precision,matched_place_name,matched_address,geocoded_at FROM ${TABLE} WHERE cache_key=?`).bind(key).first();
    if(cached){
      cachedHits++;
      results.push({merchant:row.merchant,status:'cached',precision:cached.precision,address:cached.matched_address||''});
      continue;
    }

    searched++;
    let hit=null;

    if(mode==='exact'){
      hit=await resolveExactAddress(row,env.KAKAO_REST_API_KEY);
    }else if(mode==='market'){
      hit=await resolveMarketAddress(row,env.KAKAO_REST_API_KEY);
    }else{
      hit=await resolveMerchant(row,env.KAKAO_REST_API_KEY);
    }

    if(!hit){
      failed++;
      results.push({merchant:row.merchant,status:'failed'});
      continue;
    }

    await env.DB.prepare(`
      INSERT INTO ${TABLE}(cache_key,region,market,merchant,lng,lat,precision,matched_place_name,matched_address,geocoded_at)
      VALUES(?,?,?,?,?,?,?,?,?,datetime('now'))
      ON CONFLICT(cache_key) DO UPDATE SET
        lng=excluded.lng,lat=excluded.lat,precision=excluded.precision,
        matched_place_name=excluded.matched_place_name,matched_address=excluded.matched_address,
        geocoded_at=datetime('now')
    `).bind(key,row.region||'',row.market||'',row.merchant||'',hit.lng,hit.lat,hit.precision,hit.placeName||'',hit.address||'').run();

    success++;
    results.push({merchant:row.merchant,status:'saved',precision:hit.precision,address:hit.address||''});
  }

  const nextCursor=cursor+slice.length;
  await saveProgress(env.DB,stage,nextCursor,list.length);

  return json({
    ok:true,stage,total:list.length,cursor,nextCursor,done:nextCursor>=list.length,
    processed:slice.length,cachedHits,searched,success,failed,results,
    resumedFrom:savedCursor
  });
}

async function resolveExactAddress(row,key){
  const q=String(row.address||'').replace(/\([^)]*\)/g,' ').replace(/\s+/g,' ').trim();
  if(!q)return null;
  const docs=await kakaoAddress(q,key);
  const x=docs.find(d=>regionMatches(d,row.region));
  if(x)return {
    lng:Number(x.x),lat:Number(x.y),
    placeName:row.merchant||row.market||'',
    address:String(x.road_address?.address_name||x.address_name||row.address||'').trim(),
    precision:'exact-address-geocode'
  };
  // address API failed, try keyword by full address
  const kd=await kakaoKeyword(q,key);
  const kx=kd.find(d=>regionMatches(d,row.region));
  if(kx)return {
    lng:Number(kx.x),lat:Number(kx.y),
    placeName:String(kx.place_name||row.merchant||'').trim(),
    address:String(kx.road_address_name||kx.address_name||row.address||'').trim(),
    precision:'exact-address-geocode'
  };
  return null;
}

async function resolveMarketAddress(row,key){
  const q=String(row.address||'').replace(/\([^)]*\)/g,' ').replace(/\s+/g,' ').trim();
  if(q){
    const docs=await kakaoAddress(q,key);
    const x=docs.find(d=>regionMatches(d,row.region));
    if(x)return {
      lng:Number(x.x),lat:Number(x.y),
      placeName:row.market||'',
      address:String(x.road_address?.address_name||x.address_name||row.address||'').trim(),
      precision:'market-zone'
    };
  }
  const docs=await kakaoKeyword([row.region,row.market].filter(Boolean).join(' '),key);
  const x=docs.find(d=>regionMatches(d,row.region));
  if(x)return {
    lng:Number(x.x),lat:Number(x.y),
    placeName:String(x.place_name||row.market||'').trim(),
    address:String(x.road_address_name||x.address_name||row.address||'').trim(),
    precision:'market-zone'
  };
  return null;
}

async function resolveMerchant(row,key){
  const queries=[
    [row.region,row.market,row.merchant].filter(Boolean).join(' '),
    [row.region,row.merchant].filter(Boolean).join(' '),
    [row.market,row.merchant].filter(Boolean).join(' ')
  ];
  for(const q of queries){
    const docs=await kakaoKeyword(q,key);
    const candidates=docs.filter(x=>regionMatches(x,row.region));
    if(!candidates.length)continue;
    const ranked=candidates.map(x=>({x,score:nameScore(x.place_name,row.merchant,row.market)})).sort((a,b)=>b.score-a.score);
    const best=ranked[0];
    if(!best||best.score<55)continue;
    return {
      lng:Number(best.x.x),lat:Number(best.x.y),
      placeName:String(best.x.place_name||'').trim(),
      address:String(best.x.road_address_name||best.x.address_name||'').trim(),
      precision:best.score>=90?'merchant-keyword':'merchant-keyword-relaxed'
    };
  }
  const docs=await kakaoKeyword([row.region,row.market].filter(Boolean).join(' '),key);
  const x=docs.find(d=>regionMatches(d,row.region));
  if(x)return {
    lng:Number(x.x),lat:Number(x.y),
    placeName:String(x.place_name||row.market||'').trim(),
    address:String(x.road_address_name||x.address_name||'').trim(),
    precision:'market-zone'
  };
  return null;
}

async function kakaoAddress(query,key){
  try{
    const u=new URL('https://dapi.kakao.com/v2/local/search/address.json');
    u.searchParams.set('query',query);
    const r=await fetch(u,{headers:{Authorization:`KakaoAK ${key}`}});
    if(!r.ok)return [];
    const d=await r.json().catch(()=>({}));
    return (d.documents||[]).filter(x=>valid(Number(x.y),Number(x.x)));
  }catch{return []}
}
async function kakaoKeyword(query,key){
  try{
    const u=new URL('https://dapi.kakao.com/v2/local/search/keyword.json');
    u.searchParams.set('query',query);
    u.searchParams.set('size','15');
    const r=await fetch(u,{headers:{Authorization:`KakaoAK ${key}`}});
    if(!r.ok)return [];
    const d=await r.json().catch(()=>({}));
    return (d.documents||[]).filter(x=>valid(Number(x.y),Number(x.x)));
  }catch{return []}
}
function regionMatches(x,region){
  const hay=normalize(`${x?.road_address_name||''} ${x?.address_name||''} ${x?.road_address?.address_name||''}`);
  const r=normalize(region);
  if(!r)return true;
  if(r.includes('세종'))return hay.includes('세종');
  if(r.includes('대전'))return hay.includes('대전');
  return hay.includes(r);
}
function nameScore(place,merchant,market){
  const p=normalize(place),m=normalize(merchant),mk=normalize(market);
  let s=0;
  if(m&&p===m)s+=100;
  else if(m&&(p.includes(m)||m.includes(p)))s+=70;
  if(mk&&p.includes(mk))s+=15;
  return s;
}
function cacheKey(region,market,merchant){return normalize([region,market,merchant].filter(Boolean).join('|'))}
function normalize(v){return String(v||'').replace(/\s+/g,'').replace(/[()·ㆍ\-_]/g,'').toLowerCase()}
function valid(lat,lng){return Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=32&&lat<=40.5&&lng>=123&&lng<=133}
async function ensureSchema(db){
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS ${TABLE}(
      cache_key TEXT PRIMARY KEY,region TEXT,market TEXT,merchant TEXT,
      lng REAL NOT NULL,lat REAL NOT NULL,precision TEXT,
      matched_place_name TEXT,matched_address TEXT,geocoded_at TEXT NOT NULL
    )
  `).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_${TABLE}_market ON ${TABLE}(market)`).run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS ${PROGRESS_TABLE}(
      stage TEXT PRIMARY KEY,
      cursor INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();
}
async function saveProgress(db,stage,cursor,total){
  await db.prepare(`
    INSERT INTO ${PROGRESS_TABLE}(stage,cursor,total,updated_at)
    VALUES(?,?,?,datetime('now'))
    ON CONFLICT(stage) DO UPDATE SET
      cursor=MAX(${PROGRESS_TABLE}.cursor,excluded.cursor),
      total=excluded.total,
      updated_at=datetime('now')
  `).bind(stage,Math.max(0,Number(cursor)||0),Math.max(0,Number(total)||0)).run();
}
async function readProgress(db,totals){
  const rows=await db.prepare(`SELECT stage,cursor,total,updated_at FROM ${PROGRESS_TABLE}`).all();
  const byStage={};
  for(const r of rows?.results||[])byStage[r.stage]=r;
  const exact=Math.min(totals.exact,Math.max(0,Number(byStage.exact?.cursor||0)));
  const market=Math.min(totals.market,Math.max(0,Number(byStage.market?.cursor||0)));
  const unresolved=Math.min(totals.unresolved,Math.max(0,Number(byStage.unresolved?.cursor||0)));
  return {
    exact:{cursor:exact,total:totals.exact,done:exact>=totals.exact},
    market:{cursor:market,total:totals.market,done:market>=totals.market},
    unresolved:{cursor:unresolved,total:totals.unresolved,done:unresolved>=totals.unresolved},
    done:exact+market+unresolved,
    total:totals.exact+totals.market+totals.unresolved
  };
}
async function bootstrapProgressIfEmpty(db,totals,cachedCount){
  const row=await db.prepare(`SELECT COUNT(*) AS n FROM ${PROGRESS_TABLE}`).first();
  if(Number(row?.n||0)>0)return;

  // 7.6.5.7 이하에서 이미 처리된 D1 캐시를 첫 업그레이드 시 1회 이어받기.
  // 기존 배치가 exact -> market -> unresolved 순서였으므로 캐시 건수를 동일 순서의 cursor로 환산한다.
  let remaining=Math.max(0,Math.min(
    totals.exact+totals.market+totals.unresolved,
    Number(cachedCount)||0
  ));
  const exact=Math.min(totals.exact,remaining);remaining-=exact;
  const market=Math.min(totals.market,remaining);remaining-=market;
  const unresolved=Math.min(totals.unresolved,remaining);
  await saveProgress(db,'exact',exact,totals.exact);
  await saveProgress(db,'market',market,totals.market);
  await saveProgress(db,'unresolved',unresolved,totals.unresolved);
}
async function requireFirebaseUser(request,env){
  const key=env.FIREBASE_WEB_API_KEY||request.headers.get('x-firebase-api-key')||'',h=request.headers.get('authorization')||'',token=h.startsWith('Bearer ')?h.slice(7):'';
  if(!key||!token)return null;
  const r=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(key)}`,{
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({idToken:token})
  });
  if(!r.ok)return null;
  const d=await r.json().catch(()=>({})),u=d.users?.[0];
  return u?.localId?{uid:u.localId,email:u.email||''}:null;
}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store'}})}
