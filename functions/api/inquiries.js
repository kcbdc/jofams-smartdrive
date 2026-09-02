export async function onRequest({request,env}){
  if(!env.DB)return json({ok:false,error:'D1 binding DB is not configured'},503);
  const user=await requireFirebaseUser(request,env);if(!user)return json({ok:false,error:'login required'},401);
  await ensureSchema(env.DB);const url=new URL(request.url),method=request.method.toUpperCase(),id=Number(url.searchParams.get('id'));
  if(method==='GET'){
    if(Number.isFinite(id)&&id>0){const row=await env.DB.prepare(`SELECT id,title,body,status,answer,created_at,updated_at FROM user_inquiries WHERE id=? AND firebase_uid=?`).bind(id,user.uid).first();if(!row)return json({ok:false,error:'not found'},404);return json({ok:true,item:map(row)});}
    const {results=[]}=await env.DB.prepare(`SELECT id,title,body,status,answer,created_at,updated_at FROM user_inquiries WHERE firebase_uid=? ORDER BY created_at DESC LIMIT 100`).bind(user.uid).all();return json({ok:true,items:results.map(map)});
  }
  if(method==='POST'){
    const b=await request.json().catch(()=>({})),title=clean(b.title,100),body=clean(b.body,3000);if(title.length<2||body.length<5)return json({ok:false,error:'title and body are required'},400);
    const rs=await env.DB.prepare(`INSERT INTO user_inquiries(firebase_uid,title,body,status,created_at,updated_at) VALUES(?,?,?,'received',datetime('now'),datetime('now'))`).bind(user.uid,title,body).run();return json({ok:true,stored:true,id:rs.meta?.last_row_id||null});
  }
  return json({ok:false,error:'method not allowed'},405);
}
async function requireFirebaseUser(request,env){const key=env.FIREBASE_WEB_API_KEY,h=request.headers.get('authorization')||'',token=h.startsWith('Bearer ')?h.slice(7):'';if(!key||!token)return null;const r=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(key)}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({idToken:token})});if(!r.ok)return null;const d=await r.json().catch(()=>({})),u=d.users?.[0];return u?.localId?{uid:u.localId,email:u.email||''}:null}
async function ensureSchema(db){await db.prepare(`CREATE TABLE IF NOT EXISTS user_inquiries (id INTEGER PRIMARY KEY AUTOINCREMENT, firebase_uid TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'received', answer TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))` ).run();await db.prepare(`CREATE INDEX IF NOT EXISTS idx_user_inquiries_uid_created ON user_inquiries(firebase_uid,created_at DESC)`).run()}
function map(r){return{id:String(r.id),title:r.title,body:r.body,status:r.status,answer:r.answer||'',createdAt:r.created_at,updatedAt:r.updated_at}}function clean(v,max){return String(v??'').trim().slice(0,max)}function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store'}})}
