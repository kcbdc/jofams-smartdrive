export async function onRequest({request,env}){
  if(!env.DB)return json({ok:false,error:'D1 binding DB is not configured'},503);
  await ensureSchema(env.DB);
  const url=new URL(request.url),method=request.method.toUpperCase();
  const owner=clean(url.searchParams.get('owner'),180);
  if(method==='GET'){
    if(!owner)return json({ok:false,error:'owner is required'},400);
    const {results=[]}=await env.DB.prepare(`SELECT kind, place_id, name, address, lng, lat, updated_at FROM saved_places WHERE owner_key=?`).bind(owner).all();
    const items={};for(const r of results)items[r.kind]={id:r.place_id||'',name:r.name,address:r.address||'',lng:Number(r.lng),lat:Number(r.lat),updatedAt:r.updated_at};
    return json({ok:true,items});
  }
  if(method==='POST'){
    const body=await request.json().catch(()=>({})),o=clean(body.owner||owner,180),kind=String(body.kind||url.searchParams.get('kind')||''),p=body.place||{};
    if(!o||!['home','work'].includes(kind))return json({ok:false,error:'owner and valid kind are required'},400);
    const lng=Number(p.lng),lat=Number(p.lat),name=clean(p.name,160),address=clean(p.address,300),id=clean(p.id,180);
    if(!name||!Number.isFinite(lng)||!Number.isFinite(lat))return json({ok:false,error:'valid place is required'},400);
    await env.DB.prepare(`INSERT INTO saved_places(owner_key,kind,place_id,name,address,lng,lat,updated_at) VALUES(?,?,?,?,?,?,?,datetime('now')) ON CONFLICT(owner_key,kind) DO UPDATE SET place_id=excluded.place_id,name=excluded.name,address=excluded.address,lng=excluded.lng,lat=excluded.lat,updated_at=datetime('now')`).bind(o,kind,id||null,name,address||null,lng,lat).run();
    return json({ok:true,stored:true,kind,place:{id,name,address,lng,lat}});
  }
  if(method==='DELETE'){
    const kind=String(url.searchParams.get('kind')||'');if(!owner||!['home','work'].includes(kind))return json({ok:false,error:'owner and valid kind are required'},400);
    await env.DB.prepare(`DELETE FROM saved_places WHERE owner_key=? AND kind=?`).bind(owner,kind).run();return json({ok:true,deleted:true,kind});
  }
  return json({ok:false,error:'method not allowed'},405);
}
async function ensureSchema(db){
  await db.prepare(`CREATE TABLE IF NOT EXISTS saved_places (owner_key TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('home','work')), place_id TEXT, name TEXT NOT NULL, address TEXT, lng REAL NOT NULL, lat REAL NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY(owner_key,kind))`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_saved_places_owner ON saved_places(owner_key)`).run();
}
function clean(v,max){return String(v??'').trim().slice(0,max)}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})}
