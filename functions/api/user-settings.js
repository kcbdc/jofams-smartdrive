export async function onRequest({request,env}){
  if(!env.DB)return json({ok:false,error:'D1 binding DB is not configured'},503);
  await ensureSchema(env.DB);const url=new URL(request.url),method=request.method.toUpperCase();
  let owner=clean(url.searchParams.get('owner'),180);
  const auth=await optionalFirebaseUser(request,env);if(auth?.uid)owner=`firebase:${auth.uid}`;
  if(method==='GET'){
    if(!owner)return json({ok:false,error:'owner is required'},400);
    const row=await env.DB.prepare(`SELECT route_preference,speed_camera_alert,signal_camera_alert,updated_at FROM user_navigation_settings WHERE owner_key=?`).bind(owner).first();
    return json({ok:true,settings:row?{routePreference:row.route_preference,speedCameraAlert:Boolean(row.speed_camera_alert),signalCameraAlert:Boolean(row.signal_camera_alert),updatedAt:row.updated_at}:{routePreference:'recommend',speedCameraAlert:true,signalCameraAlert:true}});
  }
  if(method==='POST'){
    const body=await request.json().catch(()=>({}));if(auth?.uid)owner=`firebase:${auth.uid}`;else owner=clean(body.owner||owner,180);if(!owner)return json({ok:false,error:'owner is required'},400);
    const route=['recommend','fast','free'].includes(body.routePreference)?body.routePreference:'recommend',speed=body.speedCameraAlert===false?0:1,signal=body.signalCameraAlert===false?0:1;
    await env.DB.prepare(`INSERT INTO user_navigation_settings(owner_key,route_preference,speed_camera_alert,signal_camera_alert,updated_at) VALUES(?,?,?,?,datetime('now')) ON CONFLICT(owner_key) DO UPDATE SET route_preference=excluded.route_preference,speed_camera_alert=excluded.speed_camera_alert,signal_camera_alert=excluded.signal_camera_alert,updated_at=datetime('now')`).bind(owner,route,speed,signal).run();
    return json({ok:true,stored:true,settings:{routePreference:route,speedCameraAlert:Boolean(speed),signalCameraAlert:Boolean(signal)}});
  }
  return json({ok:false,error:'method not allowed'},405);
}
async function optionalFirebaseUser(request,env){const h=request.headers.get('authorization')||'',token=h.startsWith('Bearer ')?h.slice(7):'';if(!token)return null;return verifyToken(token,env)}
async function verifyToken(token,env){const key=env.FIREBASE_WEB_API_KEY;if(!key)return null;const r=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(key)}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({idToken:token})});if(!r.ok)return null;const d=await r.json().catch(()=>({})),u=d.users?.[0];return u?.localId?{uid:u.localId,email:u.email||''}:null}
async function ensureSchema(db){await db.prepare(`CREATE TABLE IF NOT EXISTS user_navigation_settings (owner_key TEXT PRIMARY KEY, route_preference TEXT NOT NULL DEFAULT 'recommend', speed_camera_alert INTEGER NOT NULL DEFAULT 1, signal_camera_alert INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL DEFAULT (datetime('now')))` ).run()}
function clean(v,max){return String(v??'').trim().slice(0,max)}function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})}
