const ADMIN_EMAIL='churchoffire@gmail.com';
export async function onRequest({request,env}){
  if(!env.DB)return json({ok:false,error:'D1 binding DB is not configured'},503);
  await ensureSchema(env.DB);const u=new URL(request.url),type=u.searchParams.get('type')||'content',method=request.method.toUpperCase();
  if(type==='notices'){
    if(method==='GET'){const {results=[]}=await env.DB.prepare(`SELECT id,title,body,created_at,updated_at FROM app_notices ORDER BY created_at DESC LIMIT 100`).all();return json({ok:true,items:results.map(r=>({id:String(r.id),title:r.title,body:r.body,createdAt:r.created_at,date:r.created_at?.slice(0,10)||''}))});}
    const admin=await requireAdmin(request,env);if(!admin)return json({ok:false,error:'admin required'},403);
    if(method==='POST'){const b=await request.json().catch(()=>({})),title=clean(b.title,120),body=clean(b.body,5000);if(title.length<2||body.length<2)return json({ok:false,error:'invalid notice'},400);const rs=await env.DB.prepare(`INSERT INTO app_notices(title,body,created_by,created_at,updated_at) VALUES(?,?,?,datetime('now'),datetime('now'))`).bind(title,body,admin.uid).run();return json({ok:true,id:rs.meta?.last_row_id||null});}
    if(method==='DELETE'){const b=await request.json().catch(()=>({})),id=Number(b.id);if(!id)return json({ok:false,error:'id required'},400);await env.DB.prepare(`DELETE FROM app_notices WHERE id=?`).bind(id).run();return json({ok:true});}
  }
  if(type==='content'){
    if(method==='GET'){const {results=[]}=await env.DB.prepare(`SELECT content_key,content_value FROM app_content WHERE content_key IN ('app_info','privacy')`).all();const m=Object.fromEntries(results.map(r=>[r.content_key,r.content_value]));return json({ok:true,content:{appInfo:m.app_info||'조팸스 내비 MVP 7.5.4',privacy:m.privacy||'개인정보처리방침이 준비 중입니다.'}});}
    const admin=await requireAdmin(request,env);if(!admin)return json({ok:false,error:'admin required'},403);
    if(method==='PUT'){const b=await request.json().catch(()=>({})),appInfo=clean(b.appInfo,8000),privacy=clean(b.privacy,15000);await upsert(env.DB,'app_info',appInfo,admin.uid);await upsert(env.DB,'privacy',privacy,admin.uid);return json({ok:true});}
  }
  return json({ok:false,error:'method not allowed'},405);
}
async function upsert(db,key,value,uid){await db.prepare(`INSERT INTO app_content(content_key,content_value,updated_by,updated_at) VALUES(?,?,?,datetime('now')) ON CONFLICT(content_key) DO UPDATE SET content_value=excluded.content_value,updated_by=excluded.updated_by,updated_at=datetime('now')`).bind(key,value,uid).run()}
async function requireAdmin(request,env){const u=await requireFirebaseUser(request,env);return u&&String(u.email||'').toLowerCase()===ADMIN_EMAIL?u:null}
async function requireFirebaseUser(request,env){const key=env.FIREBASE_WEB_API_KEY,h=request.headers.get('authorization')||'',token=h.startsWith('Bearer ')?h.slice(7):'';if(!key||!token)return null;const r=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(key)}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({idToken:token})});if(!r.ok)return null;const d=await r.json().catch(()=>({})),x=d.users?.[0];return x?.localId?{uid:x.localId,email:x.email||''}:null}
async function ensureSchema(db){await db.prepare(`CREATE TABLE IF NOT EXISTS app_notices (id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,body TEXT NOT NULL,created_by TEXT,created_at TEXT NOT NULL DEFAULT (datetime('now')),updated_at TEXT NOT NULL DEFAULT (datetime('now')))` ).run();await db.prepare(`CREATE TABLE IF NOT EXISTS app_content (content_key TEXT PRIMARY KEY,content_value TEXT NOT NULL DEFAULT '',updated_by TEXT,updated_at TEXT NOT NULL DEFAULT (datetime('now')))` ).run()}
function clean(v,max){return String(v??'').trim().slice(0,max)}function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})}
