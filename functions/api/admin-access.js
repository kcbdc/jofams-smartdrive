const ADMIN_EMAIL='churchoffire@gmail.com';

export async function onRequest({request,env}){
  const user=await requireFirebaseUser(request,env);
  if(!user)return json({ok:false,isAdmin:false,error:'login required'},401);
  const email=normalizeEmail(user.email);
  return json({ok:true,isAdmin:email===normalizeEmail(ADMIN_EMAIL),email});
}
function normalizeEmail(v){return String(v||'').trim().toLowerCase()}
async function requireFirebaseUser(request,env){
  const key=env.FIREBASE_WEB_API_KEY;
  const h=request.headers.get('authorization')||'';
  const token=h.startsWith('Bearer ')?h.slice(7):'';
  if(!key||!token)return null;
  const r=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(key)}`,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({idToken:token})
  });
  if(!r.ok)return null;
  const d=await r.json().catch(()=>({}));
  const u=d.users?.[0];
  return u?.localId?{uid:u.localId,email:u.email||''}:null;
}
function json(data,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store'}
  });
}
