export async function onRequest({request,env}){
  if(!env.DB)return json({ok:false,error:'D1 binding DB is not configured'},503);
  await ensureSchema(env.DB);
  const url=new URL(request.url),method=request.method.toUpperCase();
  const owner=clean(url.searchParams.get('owner'),180);
  if(method==='GET'){
    if(!owner)return json({ok:false,error:'owner is required'},400);
    const {results=[]}=await env.DB.prepare(`SELECT favorite_id, place_id, name, address, lng, lat, created_at, updated_at FROM favorite_places WHERE owner_key=? ORDER BY updated_at DESC`).bind(owner).all();
    return json({ok:true,items:results.map(r=>({id:r.favorite_id,placeId:r.place_id||'',name:r.name,address:r.address||'',lng:Number(r.lng),lat:Number(r.lat),createdAt:r.created_at,updatedAt:r.updated_at}))});
  }
  if(method==='POST'){
    const body=await request.json().catch(()=>({})),o=clean(body.owner||owner,180),p=body.place||{};
    if(!o)return json({ok:false,error:'owner is required'},400);
    const lng=Number(p.lng),lat=Number(p.lat),name=clean(p.name,160),address=clean(p.address,300),placeId=clean(p.placeId||p.id,180);
    if(!name||!Number.isFinite(lng)||!Number.isFinite(lat))return json({ok:false,error:'valid place is required'},400);
    const favoriteId=clean(body.favoriteId||p.favoriteId||coordId(lat,lng),180);
    await env.DB.prepare(`INSERT INTO favorite_places(owner_key,favorite_id,place_id,name,address,lng,lat,created_at,updated_at) VALUES(?,?,?,?,?,?,?,datetime('now'),datetime('now')) ON CONFLICT(owner_key,favorite_id) DO UPDATE SET place_id=excluded.place_id,name=excluded.name,address=excluded.address,lng=excluded.lng,lat=excluded.lat,updated_at=datetime('now')`).bind(o,favoriteId,placeId||null,name,address||null,lng,lat).run();
    return json({ok:true,stored:true,item:{id:favoriteId,placeId,name,address,lng,lat}});
  }
  if(method==='DELETE'){
    if(!owner)return json({ok:false,error:'owner is required'},400);
    const favoriteId=clean(url.searchParams.get('favoriteId'),180);
    if(!favoriteId)return json({ok:false,error:'favoriteId is required'},400);
    await env.DB.prepare(`DELETE FROM favorite_places WHERE owner_key=? AND favorite_id=?`).bind(owner,favoriteId).run();
    return json({ok:true,deleted:true,favoriteId});
  }
  return json({ok:false,error:'method not allowed'},405);
}
async function ensureSchema(db){
  await db.prepare(`CREATE TABLE IF NOT EXISTS favorite_places (owner_key TEXT NOT NULL, favorite_id TEXT NOT NULL, place_id TEXT, name TEXT NOT NULL, address TEXT, lng REAL NOT NULL, lat REAL NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY(owner_key,favorite_id))`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_favorite_places_owner_updated ON favorite_places(owner_key,updated_at DESC)`).run();
}
function coordId(lat,lng){return `${Number(lat).toFixed(5)}_${Number(lng).toFixed(5)}`}
function clean(v,max){return String(v??'').trim().slice(0,max)}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})}
