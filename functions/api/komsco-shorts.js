const ADMIN_EMAIL='churchoffire@gmail.com';
const CHANNEL_HANDLE='prkomsco';
const CACHE_TTL_MS=6*60*60*1000; // 6시간
const MAX_SHORT_DURATION_SEC=60;
const JSON_HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=300'};

export async function onRequest({request,env}){
  if(!env.DB)return json({ok:false,error:'D1 binding DB is not configured'},503);
  await ensureSchema(env.DB);
  const u=new URL(request.url),method=request.method.toUpperCase(),action=u.searchParams.get('action')||'';

  if(method==='GET'&&!action){
    const settings=await loadSettings(env.DB);
    if(!settings.enabled)return json({ok:true,enabled:false,items:[]});
    await refreshIfStale(env);
    const scope=u.searchParams.get('scope');
    const items=scope==='full'
      ? await readCache(env.DB,{...settings,limit:20,sort:'latest'})
      : await readCache(env.DB,settings);
    return json({ok:true,enabled:true,items,channel:CHANNEL_HANDLE});
  }

  // 이하는 관리자 전용 동작
  const admin=await requireAdmin(request,env);
  if(!admin)return json({ok:false,error:'admin required'},403);

  if(method==='GET'&&action==='admin-list'){
    const settings=await loadSettings(env.DB);
    const {results=[]}=await env.DB.prepare(
      `SELECT video_id,title,thumbnail_url,published_at,duration_sec,view_count,excluded FROM komsco_shorts_cache ORDER BY published_at DESC LIMIT 50`
    ).all();
    return json({ok:true,settings,items:results.map(mapRow)});
  }

  if(method==='PUT'&&action==='settings'){
    const b=await request.json().catch(()=>({}));
    const settings={
      enabled: b.enabled!==false,
      limit: clampInt(b.limit,1,10,6),
      sort: b.sort==='views'?'views':'latest',
    };
    await upsertContent(env.DB,'komsco_shorts_settings',JSON.stringify(settings),admin.uid);
    return json({ok:true,settings});
  }

  if(method==='POST'&&action==='exclude'){
    const b=await request.json().catch(()=>({})),videoId=clean(b.videoId,64);
    if(!videoId)return json({ok:false,error:'videoId required'},400);
    await env.DB.prepare(`UPDATE komsco_shorts_cache SET excluded=1 WHERE video_id=?`).bind(videoId).run();
    return json({ok:true});
  }

  if(method==='POST'&&action==='include'){
    const b=await request.json().catch(()=>({})),videoId=clean(b.videoId,64);
    if(!videoId)return json({ok:false,error:'videoId required'},400);
    await env.DB.prepare(`UPDATE komsco_shorts_cache SET excluded=0 WHERE video_id=?`).bind(videoId).run();
    return json({ok:true});
  }

  if(method==='POST'&&action==='refresh'){
    try{
      const count=await refreshFromYouTube(env);
      return json({ok:true,refreshed:count});
    }catch(e){
      return json({ok:false,error:String(e?.message||e)},502);
    }
  }

  return json({ok:false,error:'method not allowed'},405);
}

async function readCache(db,settings){
  const orderBy=settings.sort==='views'?'view_count DESC':'published_at DESC';
  const {results=[]}=await db.prepare(
    `SELECT video_id,title,thumbnail_url,published_at,duration_sec,view_count FROM komsco_shorts_cache WHERE excluded=0 ORDER BY ${orderBy} LIMIT ?`
  ).bind(settings.limit).all();
  return results.map(mapRow);
}

function mapRow(r){
  return {
    videoId:r.video_id,
    title:r.title,
    thumbnailUrl:r.thumbnail_url,
    publishedAt:r.published_at,
    durationSec:r.duration_sec,
    viewCount:r.view_count,
    excluded:!!r.excluded,
    watchUrl:`https://www.youtube.com/watch?v=${r.video_id}`,
    embedUrl:`https://www.youtube.com/embed/${r.video_id}`,
  };
}

async function loadSettings(db){
  const row=await db.prepare(`SELECT content_value FROM app_content WHERE content_key='komsco_shorts_settings'`).first().catch(()=>null);
  const defaults={enabled:true,limit:6,sort:'latest'};
  if(!row?.content_value)return defaults;
  try{const parsed=JSON.parse(row.content_value);return {...defaults,...parsed}}catch{return defaults}
}

async function refreshIfStale(env){
  const row=await env.DB.prepare(`SELECT MAX(cached_at) as last FROM komsco_shorts_cache`).first().catch(()=>null);
  const last=row?.last?Date.parse(row.last+'Z'):0;
  if(Date.now()-last<CACHE_TTL_MS)return;
  try{await refreshFromYouTube(env)}catch(e){console.warn('komsco-shorts refresh failed',e)}
}

async function refreshFromYouTube(env){
  const apiKey=String(env.YOUTUBE_API_KEY||'').trim();
  if(!apiKey)throw new Error('YOUTUBE_API_KEY가 서버 환경변수에 설정되어 있지 않습니다.');

  // 1) 핸들 -> 채널 ID -> uploads 재생목록 ID
  const chRes=await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&forHandle=${encodeURIComponent(CHANNEL_HANDLE)}&key=${apiKey}`);
  const chData=await chRes.json();
  const uploadsPlaylistId=chData?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if(!uploadsPlaylistId)throw new Error('채널의 업로드 재생목록을 찾을 수 없습니다.');

  // 2) 업로드 재생목록에서 최근 영상 목록 (1 unit)
  const plRes=await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=25&playlistId=${uploadsPlaylistId}&key=${apiKey}`);
  const plData=await plRes.json();
  const videoIds=(plData?.items||[]).map(it=>it.snippet?.resourceId?.videoId).filter(Boolean);
  if(!videoIds.length)return 0;

  // 3) 영상 상세(길이, 조회수)로 Shorts(<=60초) 판별
  const vRes=await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics,snippet&id=${videoIds.join(',')}&key=${apiKey}`);
  const vData=await vRes.json();
  const shorts=(vData?.items||[])
    .map(v=>({
      videoId:v.id,
      title:String(v.snippet?.title||'').slice(0,200),
      thumbnailUrl:v.snippet?.thumbnails?.high?.url||v.snippet?.thumbnails?.medium?.url||'',
      publishedAt:v.snippet?.publishedAt||null,
      durationSec:parseIsoDuration(v.contentDetails?.duration),
      viewCount:Number(v.statistics?.viewCount||0),
    }))
    .filter(v=>v.durationSec>0&&v.durationSec<=MAX_SHORT_DURATION_SEC);

  for(const s of shorts){
    await env.DB.prepare(
      `INSERT INTO komsco_shorts_cache(video_id,title,thumbnail_url,published_at,duration_sec,view_count,cached_at)
       VALUES(?,?,?,?,?,?,datetime('now'))
       ON CONFLICT(video_id) DO UPDATE SET title=excluded.title,thumbnail_url=excluded.thumbnail_url,
         published_at=excluded.published_at,duration_sec=excluded.duration_sec,view_count=excluded.view_count,cached_at=datetime('now')`
    ).bind(s.videoId,s.title,s.thumbnailUrl,s.publishedAt,s.durationSec,s.viewCount).run();
  }
  return shorts.length;
}

function parseIsoDuration(iso){
  if(!iso)return 0;
  const m=/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if(!m)return 0;
  const h=Number(m[1]||0),min=Number(m[2]||0),s=Number(m[3]||0);
  return h*3600+min*60+s;
}

async function upsertContent(db,key,value,uid){
  await db.prepare(
    `INSERT INTO app_content(content_key,content_value,updated_by,updated_at) VALUES(?,?,?,datetime('now'))
     ON CONFLICT(content_key) DO UPDATE SET content_value=excluded.content_value,updated_by=excluded.updated_by,updated_at=datetime('now')`
  ).bind(key,value,uid).run();
}

async function requireAdmin(request,env){
  const u=await requireFirebaseUser(request,env);
  return u&&String(u.email||'').toLowerCase()===ADMIN_EMAIL?u:null;
}
async function requireFirebaseUser(request,env){
  const key=env.FIREBASE_WEB_API_KEY,h=request.headers.get('authorization')||'',token=h.startsWith('Bearer ')?h.slice(7):'';
  if(!key||!token)return null;
  const r=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(key)}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({idToken:token})});
  if(!r.ok)return null;
  const d=await r.json().catch(()=>({})),x=d.users?.[0];
  return x?.localId?{uid:x.localId,email:x.email||''}:null;
}

async function ensureSchema(db){
  await db.prepare(`CREATE TABLE IF NOT EXISTS komsco_shorts_cache (
    video_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    thumbnail_url TEXT NOT NULL,
    published_at TEXT,
    duration_sec INTEGER,
    view_count INTEGER,
    excluded INTEGER NOT NULL DEFAULT 0,
    cached_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run();
}

function clampInt(v,min,max,def){const n=Number(v);if(!Number.isFinite(n))return def;return Math.max(min,Math.min(max,Math.round(n)))}
function clean(v,max){return String(v??'').trim().slice(0,max)}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:JSON_HEADERS})}
