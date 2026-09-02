export async function onRequest({request,env}){
  if(!env.DB)return json({ok:false,error:'D1 binding DB is not configured'},503);
  await ensureSchema(env.DB);
  const url=new URL(request.url),method=request.method.toUpperCase(),owner=clean(url.searchParams.get('owner'),180);
  if(method==='GET'){
    if(!owner)return json({ok:false,error:'owner is required'},400);
    const {results=[]}=await env.DB.prepare(`SELECT recent_id,place_id,name,address,lng,lat,last_used_at FROM recent_destinations WHERE owner_key=? ORDER BY last_used_at DESC LIMIT 20`).bind(owner).all();
    return json({ok:true,items:results.map(r=>({id:r.recent_id,placeId:r.place_id||'',name:r.name,address:r.address||'',lng:Number(r.lng),lat:Number(r.lat),lastUsedAt:r.last_used_at}))});
  }
  if(method==='POST'){
    const body=await request.json().catch(()=>({})),o=clean(body.owner||owner,180),p=body.place||{},lng=Number(p.lng),lat=Number(p.lat),name=clean(p.name,160),address=clean(p.address,300),placeId=clean(p.placeId||p.id,180);
    if(!o||!name||!Number.isFinite(lng)||!Number.isFinite(lat))return json({ok:false,error:'owner and valid place are required'},400);
    const recentId=clean(body.recentId||p.id||coordId(lat,lng),180);
    await env.DB.prepare(`INSERT INTO recent_destinations(owner_key,recent_id,place_id,name,address,lng,lat,last_used_at) VALUES(?,?,?,?,?,?,?,datetime('now')) ON CONFLICT(owner_key,recent_id) DO UPDATE SET place_id=excluded.place_id,name=excluded.name,address=excluded.address,lng=excluded.lng,lat=excluded.lat,last_used_at=datetime('now')`).bind(o,recentId,placeId||null,name,address||null,lng,lat).run();
    await env.DB.prepare(`DELETE FROM recent_destinations WHERE owner_key=? AND recent_id NOT IN (SELECT recent_id FROM recent_destinations WHERE owner_key=? ORDER BY last_used_at DESC LIMIT 20)`).bind(o,o).run();
    return json({ok:true,stored:true});
  }
  if(method==='DELETE'){
    if(!owner)return json({ok:false,error:'owner is required'},400);await env.DB.prepare(`DELETE FROM recent_destinations WHERE owner_key=?`).bind(owner).run();return json({ok:true,deleted:true});
  }
  return json({ok:false,error:'method not allowed'},405);
}
async function ensureSchema(db){await db.prepare(`CREATE TABLE IF NOT EXISTS recent_destinations (owner_key TEXT NOT NULL,recent_id TEXT NOT NULL,place_id TEXT,name TEXT NOT NULL,address TEXT,lng REAL NOT NULL,lat REAL NOT NULL,last_used_at TEXT NOT NULL DEFAULT (datetime('now')),PRIMARY KEY(owner_key,recent_id))`).run();await db.prepare(`CREATE INDEX IF NOT EXISTS idx_recent_destinations_owner_used ON recent_destinations(owner_key,last_used_at DESC)`).run()}
function coordId(lat,lng){return `${Number(lat).toFixed(5)}_${Number(lng).toFixed(5)}`}
function clean(v,max){return String(v??'').trim().slice(0,max)}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})}
